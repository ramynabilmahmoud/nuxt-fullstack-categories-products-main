# Nuxt 3 Full Stack Developer Assignment

This project is a full-stack application developed using Nuxt 3, Prisma, and MySQL. It includes features for managing categories and products, image resizing, and a structured API setup.

## Project Overview

The project implements CRUD operations for categories and products. It features categories displayed as a tree structure, with the ability to count products within nested categories. Images uploaded for products are resized to 3200x3200 pixels. The project is containerized using Docker for easy deployment.

## Technologies Used

- **Frontend & Backend:** Nuxt 3
- **Database:** MySQL
- **ORM:** Prisma
- **Containerization:** Docker
- **API Testing:** Postman

## Prerequisites

Ensure you have the following installed on your system:

- Docker
- Docker Compose

## Setup

### 1. Configure Environment Variables

Create a `.env` file in the root directory and set the following environment variables:

```bash
DATABASE_URL="mysql://user:password@localhost:3306/database_name"

Replace `user`, `password`, and `database_name` with your actual MySQL credentials.

### 2. Docker Deployment

#### Build and Run the Docker Containers

To build and run the application using Docker, follow these steps:

1. **Build the Docker Image**

   Build the Docker image for the Nuxt application:

   ```bash
   docker-compose build
   ```

2. **Start the Containers**

   Start the containers using Docker Compose:

   ```bash
   docker-compose up
   ```

   This will start the `nuxt-app` and `db` containers. The application will be available at `http://localhost:3000`.

3. **Access the Application**

   Once the containers are running, you can access the application in your web browser at `http://localhost:3000`.

4. **Stopping the Containers**

   To stop the containers, use:

   ```bash
   docker-compose down
   ```

## API Documentation

API documentation is available via Postman. Import the collection using the following link:
[Postman Collection](https://raw.githubusercontent.com/ramynabilmahmoud/nuxt-fullstack-categories-products-main/main/nuxt-fullstack-categories-products.postman_collection.json)

## Scripts

### Migration & Build Scripts

- **Migrate Database:** `npx prisma migrate dev --name init`
- **Build Application:** `npm run build`

## Contact

For any questions or issues, please contact: [ramynabil680@gmail.com](mailto:ramynabil680@gmail.com)

---

### Notes:

- Replace placeholders like `user`, `password`, `database_name`, and Postman collection link with actual details.
- Include any additional setup or configuration steps specific to your project.
- Ensure that the `.env` file is not committed to your public repository to protect sensitive information.
