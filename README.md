# Decorate with Convex

A real-time image decoration app built with Convex, React, and TypeScript. Upload images and get AI-generated decorated versions.

## Features

- 📱 Responsive design for both desktop and mobile
- 📸 Drag & drop image upload + mobile camera support
- 🔄 Real-time status updates
- 🔐 User authentication
- 💾 Secure file storage with Convex Storage
- 🖼️ Side-by-side image comparison

## Tech Stack

- [Convex](https://convex.dev) - Backend + Database + File Storage
- [React](https://reactjs.org) - Frontend Framework
- [TypeScript](https://www.typescriptlang.org) - Type Safety
- [TailwindCSS](https://tailwindcss.com) - Styling
- [type-route](https://type-route.zilch.dev) - Type-safe Routing

## Initial Prompt

I want to build a "decorate" web app that is going to be called "Decorate with Convex”.

I should be able to login or signup, once done I should be taken to my "dashboard" where I can see my past generations as a list of “cards” that show the image and its generate status. 

There should be a big drop zone at the top (that is also clickable) that will allow me to upload an image (or use my camera on mobile) to provide an image to use. 

Once provided we should create an “image” in the database. That “image” should have a status that is a union of objects with different “kind”  that is a literal of the state that it can be it. 

The states should be along the lines of:

1. “uploading” - this is when the user has provided an image but we are still uploading it to convex, BTW we should use convex storage to upload it: https://docs.convex.dev/file-storage/upload-files

2. “uploaded” - this is when the uploading is complete. The URL for the image should be stored on the image in the database.

3. “generating” - the user clicked the buttton that starts the generation process, and openAI is doing the generating.

4. “generated” - the image has come back as base64 then been uploaded to convex storage again and the resulting URL should be set on the image as the final URL. We should keep the initually uploaded image too so the user can flick between them.

To do the image generating we are going to use the new openai image model via the vercel ai SDK. 

For now however just mockout the actual AI generation part and just put in a fake 3-second timer or something. Use some fake URL (or some mock api image service image or something) for now.

Its important that this be a responsive mobile app so it needs to work and look good on both desktop and mobile. On mobile the main navigation options should be down the bottom.

I want to use type-route for the routing (https://type-route.zilch.dev/introduction/getting-started.html)

## Project Status

Currently implemented:
- User authentication
- Image upload to Convex Storage
- Mock image decoration (3s delay)
- Real-time status updates
- Responsive UI

TODO:
- Implement OpenAI image generation
- Add image filters and decoration options
- Add sharing capabilities

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit `http://localhost:5173` in your browser

## License

MIT
