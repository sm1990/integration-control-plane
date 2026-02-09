# Oxygen UI Test App

This is a sample Vite + React + TypeScript application demonstrating the usage of WSO2 Oxygen UI components.

## Features

This test app showcases:
- Integration of `@wso2/oxygen-ui` components
- Usage of `@wso2/oxygen-ui-icons-react` for icons
- Theme customization with `OxygenUIThemeProvider`
- MUI X Data Grid and Date Pickers integration
- TypeScript configuration for Oxygen UI

## Getting Started

### Prerequisites

- Node.js 24+ 
- pnpm 10+

### Installation

From the test app directory:

```bash
pnpm install

### Development

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

Create a production build:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Project Structure

```
oxygen-ui-test-app/
├── src/
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── ...
├── public/               # Static assets
├── index.html
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json
```

## Using Oxygen UI Components

### Basic Components

```tsx
import { Button, TextField, Box, Stack } from '@wso2/oxygen-ui';

function MyComponent() {
  return (
    <Box>
      <Stack spacing={2}>
        <TextField label="Name" />
        <Button variant="contained">Submit</Button>
      </Stack>
    </Box>
  );
}
```

### Icons

```tsx
import { Settings, User, LogOut } from '@wso2/oxygen-ui-icons-react';

function Toolbar() {
  return (
    <div>
      <Settings size={20} />
      <User size={20} />
      <LogOut size={20} />
    </div>
  );
}
```

### Theme Provider

```tsx
import { OxygenUIThemeProvider } from '@wso2/oxygen-ui';

function App() {
  return (
    <OxygenUIThemeProvider>
      {/* Your app components */}
    </OxygenUIThemeProvider>
  );
}
```

## Technologies Used

- [React 19](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Vite 7](https://vite.dev/)
- [@wso2/oxygen-ui](https://www.npmjs.com/package/@wso2/oxygen-ui) - WSO2 Oxygen UI component library
- [@wso2/oxygen-ui-icons-react](https://www.npmjs.com/package/@wso2/oxygen-ui-icons-react) - Icon library
- [@wso2/oxygen-ui-charts-react](https://www.npmjs.com/package/@wso2/oxygen-ui-charts-react) - Charts library

## Learn More

- [Material-UI Documentation](https://mui.com/material-ui/)
- [Vite Documentation](https://vite.dev/)
- [React Documentation](https://react.dev/)
- [React Router Documentation](https://reactrouter.com/)
