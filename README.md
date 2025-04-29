# Decorate with Convex

A real-time image decoration application that allows users to upload images and get AI-generated decorated versions. Built with Convex, React, and TypeScript.

## Features

- Upload images via drag & drop or file selection
- Mobile camera support for image capture
- Real-time status updates for image processing
- User authentication
- Secure file storage using Convex Storage
- Responsive design for desktop and mobile
- Side-by-side image comparison

## Tech Stack

- Convex - Backend, Database, and File Storage
- React + Vite - Frontend Framework
- TypeScript - Type Safety
- TailwindCSS - Styling
- type-route - Type-safe Routing

## Setup

1. Clone the repository

2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the dev server which will create the `.env.local` file
   ```bash
   bun dev
   ```

4. Set the OpenAI API key:
   ```bash
   bun convex env set OPEN_API_KEY <your-key>
   ```

5. Run the typescript type-cheker in another terminal window
  ```bash
  bun dev:ts
  ```

5. Visit `http://localhost:5173` in your browser

## Development Flow

1. Upload an image through the drop zone or file selector
2. The image is resized and uploaded to Convex Storage
3. The system processes the image through several states:
   - uploading: Initial file upload to Convex Storage
   - uploaded: File successfully stored
   - generating: AI decoration in progress
   - generated: Final decorated image available

## Project Structure

- `/convex` - Backend logic and database schema
- `/src` - Frontend React application
- `/public` - Static assets
- `/shared` - Shared types and utilities

## License

MIT
