# DocSqueeze - Smart PDF Compression

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind">
  <img src="https://img.shields.io/badge/shadcn/ui-000000?style=for-the-badge" alt="shadcn/ui">
</p>

<p align="center">
  A modern, fast, and secure PDF compression tool built with Next.js 14, TypeScript, and shadcn/ui.
</p>

<p align="center">
  <a href="https://docsqueeze.vercel.app">Live Demo →</a>
</p>

## ✨ Features

- **Drag & Drop Upload** - Easily upload PDF files
- **Compression Levels** - Choose from Low, Medium, or High compression
- **Quality Control** - Fine-tune compression with quality slider
- **Real-time Stats** - See original size, compressed size, and savings
- **Modern UI** - Clean, professional design inspired by Squarespace/Wix
- **Responsive** - Works on desktop and mobile devices
- **Fast Processing** - Client-side file handling with server-side compression
- **Secure** - Files are processed temporarily and not stored

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/doc-squeeze.git

# Navigate to the project
cd doc-squeeze

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **PDF Processing:** pdf-lib

## 📁 Project Structure

```
doc-squeeze/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── compress/       # Compression API endpoint
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main page
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       └── utils.ts            # Utility functions
├── public/
├── components.json              # shadcn configuration
├── next.config.ts               # Next.js configuration
├── package.json
├── tailwind.config.ts           # Tailwind configuration
└── tsconfig.json                # TypeScript configuration
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file for local development:

```env
# Optional: Add any environment variables here
```

## 📱 Usage

1. **Upload a PDF** - Drag and drop or click to browse
2. **Choose Compression Level** - Low (better quality), Medium (balanced), or High (smaller size)
3. **Adjust Quality** - Use the slider for fine-tuned control
4. **Compress** - Click the compress button
5. **Download** - Get your compressed PDF

## 🎨 Design

The UI follows modern design principles:
- Clean typography with Inter font
- Subtle gradients and shadows
- Smooth animations and transitions
- Accessible color contrast
- Mobile-first responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com) for the beautiful component library
- [pdf-lib](https://pdf-lib.js.org) for PDF manipulation
- [Lucide](https://lucide.dev) for icons
