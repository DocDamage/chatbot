# Setup Guide for Free Local LLMs

This guide will help you set up the free, local LLM (Ollama) used by the active text chat surface.

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

## Usage

### Text Chat
Simply type your message and the chatbot will respond using Ollama.

### Image Generation
The active production chat surface is text-only. Stable Diffusion is not exposed through the current settings UI or chat flow.

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

## Model Recommendations

### For Text (Ollama)
- **llama2** - Good balance of quality and speed (recommended)
- **mistral** - Fast and capable
- **codellama** - Best for code-related questions
- **phi** - Very fast, smaller model

## Performance Tips

1. **Use smaller models** if you have limited RAM/VRAM
2. **Close other applications** to free up RAM
3. **Use GPU acceleration** for Ollama when available

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
- Check the app logs for detailed error messages

