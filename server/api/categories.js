import { defineEventHandler, readBody, getQuery } from "h3";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

async function buildCategoryTree(categories) {
  const categoryMap = new Map();

  // Map categories by ID
  categories.forEach((category) => {
    categoryMap.set(category.id, { ...category, children: [] });
  });

  // Build the tree structure
  const rootCategories = [];
  categoryMap.forEach((category) => {
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  return rootCategories;
}

function countProducts(category) {
  const products = category.products || [];
  const children = category.children || [];

  let count = products.length;

  // Recursively accumulate product counts from children
  children.forEach((child) => {
    count += countProducts(child).productCount;
  });

  return { ...category, productCount: count };
}

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  try {
    switch (method) {
      case "GET":
        const categories = await prisma.categories.findMany({
          include: {
            children: {
              include: {
                children: true,
                products: true,
              },
            },
            products: true,
          },
        });

        const categoryTree = await buildCategoryTree(categories);

        // Ensure categoryTree is an array
        if (!Array.isArray(categoryTree)) {
          throw new Error("Category tree is not an array.");
        }

        const categoriesWithProductCount = categoryTree.map((category) =>
          countProducts(category)
        );

        return categoriesWithProductCount;

      case "POST":
        const createData = await readBody(event);
        let pictureUrl = "";
        let newCategory;

        // Start a transaction to ensure data consistency
        await prisma.$transaction(async (prisma) => {
          // Step 1: Create the category without the picture URL
          newCategory = await prisma.categories.create({
            data: {
              ...createData,
              parent_id: createData.parent_id || null, // Ensure parent_id is correctly set or null if no parent
              picture: "", // Temporary placeholder
            },
          });

          // Step 2: Process the image if it exists
          if (createData.picture) {
            // Convert base64 string to buffer
            const picture = createData.picture.substring(
              createData.picture.indexOf(",") + 1
            );
            const imageBuffer = Buffer.from(picture, "base64");

            // Resize the image to fit within 3200x3200
            const resizedBuffer = await sharp(imageBuffer)
              .resize(3200, 3200, { fit: "inside" })
              .toBuffer();

            // Define local directory and file name using the category ID
            const uploadDir = path.join(
              projectRoot,
              "public",
              "media",
              "categories"
            );
            const fileName = `category_${newCategory.id}.jpg`;
            const filePath = path.join(uploadDir, fileName);

            // Ensure the directory exists
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Save the resized image to a local file
            fs.writeFileSync(filePath, resizedBuffer);

            // Set the picture URL to be used in the database
            pictureUrl = `/media/categories/${fileName}`;
          }

          // Step 3: Update the category with the picture URL if the picture exists
          if (pictureUrl) {
            newCategory = await prisma.categories.update({
              where: { id: newCategory.id },
              data: {
                picture: pictureUrl,
              },
            });
          }
        });

        return newCategory;

      case "PUT":
        const updateId = Number(getQuery(event).id);
        const updateData = await readBody(event);

        // Fetch the current category to get the existing picture URL
        const currentCategory = await prisma.categories.findUnique({
          where: { id: updateId },
          select: { picture: true },
        });

        let picUrl = currentCategory ? currentCategory.picture : null;

        if (updateData.picture) {
          // The new picture is in base64 format
          const picture = updateData.picture.substring(
            updateData.picture.indexOf(",") + 1
          );
          const imageBuffer = Buffer.from(picture, "base64");
          const resizedBuffer = await sharp(imageBuffer)
            .resize(3200, 3200, { fit: "inside" })
            .toBuffer();

          const uploadDir = path.join(
            projectRoot,
            "public",
            "media",
            "categories"
          );
          const fileName = `category_${updateId}.jpg`; // Use the category ID for the file name
          const filePath = path.join(uploadDir, fileName);

          // Ensure the upload directory exists
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Remove the old image file if it exists and is different from the new file name
          if (picUrl && picUrl !== `/media/categories/${fileName}`) {
            const oldFilePath = path.join(projectRoot, "public", picUrl);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          // Save the resized image locally
          fs.writeFileSync(filePath, resizedBuffer);

          // Set the new image URL (relative to the public directory)
          picUrl = `/media/categories/${fileName}`;
        }

        // Update the category with new data
        const updatedCategory = await prisma.categories.update({
          where: { id: updateId },
          data: {
            ...updateData,
            picture: picUrl,
          },
        });

        return updatedCategory;

      case "DELETE":
        const deleteId = Number(getQuery(event).id);
        const categoryToDelete = await prisma.categories.findUnique({
          where: { id: deleteId },
        });

        if (!categoryToDelete) {
          return {
            error: "Category does not exist",
          };
        }

        // Check for associated products and children before deletion
        const childCategories = await prisma.categories.findMany({
          where: { parent_id: deleteId },
        });
        const productsInCategory = await prisma.products.findMany({
          where: { category_id: deleteId },
        });

        if (childCategories.length > 0 || productsInCategory.length > 0) {
          return {
            error:
              "Category has associated records. Handle them before deletion.",
          };
        }

        const pic = categoryToDelete.picture;
        if (pic && pic.startsWith("/media/categories/")) {
          const filePath = path.join(projectRoot, "public", pic);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        await prisma.categories.delete({
          where: { id: deleteId },
        });

        return { message: "Category deleted successfully" };

      default:
        return "Method not allowed";
    }
  } catch (error) {
    console.error("Error:", error);
    return { error: "Internal server error" };
  }
});
