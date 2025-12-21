# Quick Start Guide

Get the AI Chatbot Hub running with free local LLMs and image generation in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

## Step 2: Install Ollama (Free Local LLM)

**Windows/Mac:**
- Download from https://ollama.ai
- Install and run Ollama (it starts automatically)

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Pull a model:**
```bash
ollama pull llama2
```

## Step 3: Set Up Environment

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

The default configuration uses Ollama (free, local). No API keys needed!

## Step 4: (Optional) Set Up Stable Diffusion for Images

**Quick Setup with Automatic1111:**

```bash
# Clone Automatic1111 WebUI
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui

# Windows: Run webui-user.bat
# Mac/Linux: Run bash webui.sh

# Enable API in Settings > API
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.

## Step 5: Start the Application

### Development Mode (Recommended)

```bash
npm run dev
```

This runs both backend and frontend with hot reload.

### Production Mode

```bash
npm run build
npm start
```

## Step 6: Open the App

Open your browser to: http://localhost:3000

## Step 7: Start Chatting!

- **Text Chat**: Just type a message and press Enter
- **Image Generation**: Try phrases like:
  - "Generate an image of a sunset over mountains"
  - "Draw a cat wearing a hat"
  - "Create a picture of a futuristic city"

## Troubleshooting

### "Ollama is not running"

1. Make sure Ollama is installed and running
2. Check: `ollama list` (should show your models)
3. If not running, start Ollama application

### "Model not found"

Pull the model:
```bash
ollama pull llama2
```

### "Stable Diffusion service is not running"

- Make sure Automatic1111 WebUI is running
- Check it's accessible at http://localhost:7860
- Enable API in WebUI settings

### Port Already in Use

Change `PORT` in `.env` for the backend, or update `vite.config.ts` for frontend.

### Slow Responses

- Try a smaller model: `ollama pull llama2:7b`
- Close other applications to free up RAM
- Use GPU acceleration if available

## Next Steps

- Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for advanced configuration
- Check [README.md](README.md) for full documentation
- Explore the code to understand the architecture

## Example Questions to Try

**Text:**
- "Hello, how are you?"
- "Tell me about artificial intelligence"
- "What is the capital of France?"
- "Explain quantum computing in simple terms"

**Images:**
- "Generate an image of a sunset over mountains"
- "Draw a cat wearing a hat"
- "Create a picture of a futuristic city"
- "Show me an illustration of a dragon"

Enjoy your free, local AI chatbot! 🚀
