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

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  try {
    switch (method) {
      case "GET":
        const parentCategories = await prisma.categories.findMany({
          where: { parent_id: null }, // Only fetch parent categories
          include: {
            children: {
              include: {
                products: true, // Include products in child categories
              },
            },
            products: true, // Include products directly associated with the parent category
          },
        });

        const result = parentCategories.map((parent) => ({
          ...parent,
          products: [
            ...parent.products,
            ...parent.children.flatMap((child) => child.products),
          ],
        }));
        return result;

      case "POST":
        const createData = await readBody(event);
        let pictureUrl = "";

        // Create the product first to get the ID
        const newProduct = await prisma.products.create({
          data: {
            ...createData,
            picture: "", // Temporarily set the picture to an empty string
          },
        });

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

          // Define local directory and file name
          const uploadDir = path.join(
            projectRoot,
            "public",
            "media",
            "products"
          );

          const fileName = `product_${newProduct.id}.jpg`; // Use the new product ID for the file name
          const filePath = path.join(uploadDir, fileName);

          // Ensure the directory exists
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Save the resized image to a local file
          fs.writeFileSync(filePath, resizedBuffer);

          // Set the picture URL to be used in the database
          pictureUrl = `/media/products/${fileName}`;

          // Update the product with the picture URL
          await prisma.products.update({
            where: { id: newProduct.id },
            data: { picture: pictureUrl },
          });
        }

        return newProduct;

      case "PUT":
        const updateId = Number(getQuery(event).id);
        const updateData = await readBody(event);

        // Fetch the current category to get the existing picture URL
        const currentProduct = await prisma.products.findUnique({
          where: { id: updateId },
          select: { picture: true },
        });

        let picUrl = currentProduct ? currentProduct.picture : null;

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
            "products"
          );
          const fileName = `product_${updateId}.jpg`;
          const filePath = path.join(uploadDir, fileName);

          // Ensure the upload directory exists
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Save the resized image locally
          fs.writeFileSync(filePath, resizedBuffer);

          // Set the new image URL (relative to the public directory)
          picUrl = `/media/products/${fileName}`;
        }

        // Update the category with new data
        const updatedProduct = await prisma.products.update({
          where: { id: updateId },
          data: {
            ...updateData,
            picture: picUrl,
          },
        });

        return updatedProduct;

      case "DELETE":
        const deleteId = Number(getQuery(event).id);
        const productToDelete = await prisma.products.findUnique({
          where: { id: deleteId },
        });

        if (!productToDelete) {
          return {
            error: "Product does not exist",
          };
        }
        const pic = productToDelete.picture;
        if (pic && pic.startsWith("/media/products/")) {
          const filePath = path.join(projectRoot, "public", pic);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        await prisma.products.delete({
          where: { id: deleteId },
        });

        return { message: "product deleted successfully" };
      default:
        return "Method not allowed";
    }
  } catch (error) {
    console.error("Error:", error);
    return { error: "Internal server error" };
  }
});
