# Setup Guide for Free Local LLMs and Stable Diffusion

This guide will help you set up the free, local LLM (Ollama) and Stable Diffusion for image generation.

## Quick Setup

### Option 1: Ollama Only (Text Chat)

1. **Install Ollama**
   - Visit https://ollama.ai
   - Download and install for your operating system
   - Ollama will start automatically

2. **Pull a Model** (choose one)
   ```bash
   ollama pull llama2          # Good general purpose model (3.8GB)
   ollama pull mistral         # Fast and capable (4.1GB)
   ollama pull codellama       # Good for code (3.8GB)
   ollama pull llama2:7b       # Smaller version (3.8GB)
   ```

3. **Configure the App**
   - The app defaults to using Ollama
   - Edit `.env` if needed:
     ```env
     USE_OLLAMA=true
     OLLAMA_URL=http://localhost:11434
     OLLAMA_MODEL=llama2
     ```

4. **Start the Chatbot**
   ```bash
   npm run dev
   ```

### Option 2: Ollama + Stable Diffusion (Text + Images)

1. **Set up Ollama** (follow Option 1 steps above)

2. **Set up Stable Diffusion**

   **Option A: Automatic1111 WebUI (Recommended)**
   ```bash
   # Install Python 3.10+
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
   cd stable-diffusion-webui
   
   # On Windows, run webui-user.bat
   # On Mac/Linux, run: bash webui.sh
   
   # The WebUI will start on http://localhost:7860
   # Enable API in Settings > API
   ```

   **Option B: ComfyUI**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI
   cd ComfyUI
   pip install -r requirements.txt
   python main.py --api
   ```

3. **Configure the App**
   ```env
   USE_OLLAMA=true
   OLLAMA_MODEL=llama2
   USE_STABLE_DIFFUSION=true
   STABLE_DIFFUSION_URL=http://localhost:7860
   ```

4. **Start the Chatbot**
   ```bash
   npm run dev
   ```

## Usage

### Text Chat
Simply type your message and the chatbot will respond using Ollama.

### Image Generation
Use phrases like:
- "Generate an image of a sunset over mountains"
- "Draw a cat wearing a hat"
- "Create a picture of a futuristic city"
- "Show me an illustration of a dragon"

The system will detect image requests and generate them using Stable Diffusion while also providing a text response.

## Troubleshooting

### Ollama Issues

**Error: "Ollama is not running"**
- Make sure Ollama is installed and running
- Check if it's running: `ollama list`
- Start Ollama if it's not running

**Error: "Model not found"**
- Pull the model: `ollama pull llama2`
- Check available models: `ollama list`
- Update `.env` with the correct model name

**Slow responses**
- Try a smaller model: `ollama pull llama2:7b`
- Close other applications to free up RAM
- Consider using a GPU-enabled version of Ollama

### Stable Diffusion Issues

**Error: "Stable Diffusion service is not running"**
- Make sure Automatic1111 WebUI is running
- Check the URL in `.env` matches your WebUI address
- Enable API in WebUI settings

**Out of memory errors**
- Use a smaller image size (default is 512x512)
- Close other applications
- Use a model with lower VRAM requirements

**API not responding**
- Check WebUI logs for errors
- Verify API is enabled in settings
- Try restarting the WebUI

## Model Recommendations

### For Text (Ollama)
- **llama2** - Good balance of quality and speed (recommended)
- **mistral** - Fast and capable
- **codellama** - Best for code-related questions
- **phi** - Very fast, smaller model

### For Images (Stable Diffusion)
The chatbot works with any Stable Diffusion model. Popular options:
- **stable-diffusion-v1-5** - Default, good quality
- **stable-diffusion-xl** - Higher quality, more VRAM needed
- **anything-v4** - Popular for anime/art style
- **dreamshaper** - Versatile, good for various styles

## Performance Tips

1. **Use smaller models** if you have limited RAM/VRAM
2. **Close other applications** when generating images
3. **Adjust image size** in code if needed (default 512x512)
4. **Use GPU acceleration** for both Ollama and Stable Diffusion when available

## System Requirements

### Minimum
- 8GB RAM
- 10GB free disk space
- CPU-only (slower but works)

### Recommended
- 16GB+ RAM
- 20GB+ free disk space
- NVIDIA GPU with 6GB+ VRAM
- SSD storage

## Need Help?

- Ollama: https://github.com/ollama/ollama
- Stable Diffusion WebUI: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- Check the app logs for detailed error messages

