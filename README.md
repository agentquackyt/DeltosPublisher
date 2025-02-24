# Deltos Publisher

Deltos Publisher is a web application for creating and managing social media posts. It allows users to create posts of different types, customize their appearance, and export them as images. The application is built using TypeScript and Solid.js.

## Features

- **Post Types**: Create posts of various types such as quotes, topics, and memorials.
- **Customization**: Customize text colors, fonts, and image options.
- **Local Storage**: Save and load post data, colors, fonts, and image options from local storage.
- **Export**: Export posts as images in PNG format.
- **Responsive Design**: User-friendly interface with responsive design.

## Technologies Used

- **TypeScript**: For type-safe JavaScript development.
- **Solid.js**: A declarative JavaScript library for building user interfaces.
- **bun**: For managing project dependencies.

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/agentquackyt/deltos-publisher.git
    ```
2. Navigate to the project directory:
    ```sh
    cd deltos-publisher
    ```
3. Install dependencies:
    ```sh
    npm install
    ```

## Usage

1. Start the development server:
    ```sh
    npm start
    ```
2. Open your browser and navigate to `http://localhost:3000`.

## Project Structure

- `src/types/Stages.ts`: Contains type definitions and enums for post types and form stages.
- `src/index.tsx`: Entry point of the application, sets up routing and renders the main component.
- `src/pages/Setup.tsx`: Component for setting up a new post.
- `src/pages/InputForm.tsx`: Component for inputting post details.
- `src/pages/RenderSite.tsx`: Component for rendering and exporting the post.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.