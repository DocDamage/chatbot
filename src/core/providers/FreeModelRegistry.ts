/**
 * Free Model Registry - Catalog of all free models available
 */

export interface FreeModel {
  id: string;
  name: string;
  provider: 'ollama' | 'huggingface' | 'xenova' | 'local';
  category: 'llm' | 'vision' | 'embedding';
  model: string;
  quality: number; // 0-1
  setup: string; // Setup instructions
  description: string;
}

export class FreeModelRegistry {
  private static models: FreeModel[] = [
    // LLM Models
    {
      id: 'ollama-llama3',
      name: 'Llama 3 (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'llama3',
      quality: 0.80,
      setup: 'ollama pull llama3',
      description: 'Meta\'s latest Llama model, best free quality'
    },
    {
      id: 'ollama-mistral',
      name: 'Mistral (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'mistral',
      quality: 0.75,
      setup: 'ollama pull mistral',
      description: 'High-quality instruction-following model'
    },
    {
      id: 'ollama-llama2',
      name: 'Llama 2 (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'llama2',
      quality: 0.70,
      setup: 'ollama pull llama2',
      description: 'Meta\'s Llama 2, widely used'
    },
    {
      id: 'ollama-codellama',
      name: 'CodeLlama (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'codellama',
      quality: 0.75,
      setup: 'ollama pull codellama',
      description: 'Specialized for code generation'
    },
    {
      id: 'ollama-phi',
      name: 'Phi-2 (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'phi',
      quality: 0.65,
      setup: 'ollama pull phi',
      description: 'Small, efficient model'
    },
    {
      id: 'ollama-gemma',
      name: 'Gemma (Ollama)',
      provider: 'ollama',
      category: 'llm',
      model: 'gemma',
      quality: 0.72,
      setup: 'ollama pull gemma',
      description: 'Google\'s open model'
    },
    {
      id: 'hf-mistral',
      name: 'Mistral 7B (Hugging Face)',
      provider: 'huggingface',
      category: 'llm',
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      quality: 0.75,
      setup: 'No setup needed, uses Hugging Face Inference API',
      description: 'Free via Hugging Face API (rate limited)'
    },
    {
      id: 'hf-llama2',
      name: 'Llama 2 7B (Hugging Face)',
      provider: 'huggingface',
      category: 'llm',
      model: 'meta-llama/Llama-2-7b-chat-hf',
      quality: 0.70,
      setup: 'No setup needed, uses Hugging Face Inference API',
      description: 'Free via Hugging Face API (rate limited)'
    },
    {
      id: 'hf-zephyr',
      name: 'Zephyr 7B (Hugging Face)',
      provider: 'huggingface',
      category: 'llm',
      model: 'HuggingFaceH4/zephyr-7b-beta',
      quality: 0.73,
      setup: 'No setup needed, uses Hugging Face Inference API',
      description: 'Aligned chat model via Hugging Face'
    },
    
    // Vision Models
    {
      id: 'llava',
      name: 'LLaVA (Ollama)',
      provider: 'ollama',
      category: 'vision',
      model: 'llava',
      quality: 0.70,
      setup: 'ollama pull llava',
      description: 'Free vision-language model, local'
    },
    {
      id: 'llava-llama3',
      name: 'LLaVA Llama 3 (Ollama)',
      provider: 'ollama',
      category: 'vision',
      model: 'llava:llama3',
      quality: 0.75,
      setup: 'ollama pull llava:llama3',
      description: 'LLaVA with Llama 3, better quality'
    },
    
    // Embedding Models
    {
      id: 'xenova-minilm',
      name: 'all-MiniLM-L6-v2 (Xenova)',
      provider: 'xenova',
      category: 'embedding',
      model: 'Xenova/all-MiniLM-L6-v2',
      quality: 0.75,
      setup: 'No setup needed, downloads automatically',
      description: 'Fast, efficient embeddings (default)'
    },
    {
      id: 'xenova-multilingual',
      name: 'Multilingual E5 (Xenova)',
      provider: 'xenova',
      category: 'embedding',
      model: 'Xenova/multilingual-e5-base',
      quality: 0.80,
      setup: 'No setup needed, downloads automatically',
      description: 'Multilingual embeddings'
    },
    {
      id: 'xenova-bge',
      name: 'BGE Small (Xenova)',
      provider: 'xenova',
      category: 'embedding',
      model: 'Xenova/bge-small-en-v1.5',
      quality: 0.78,
      setup: 'No setup needed, downloads automatically',
      description: 'BGE small English embeddings'
    },
    {
      id: 'ollama-nomic-embed',
      name: 'Nomic Embed (Ollama)',
      provider: 'ollama',
      category: 'embedding',
      model: 'nomic-embed-text',
      quality: 0.80,
      setup: 'ollama pull nomic-embed-text',
      description: 'Specialized embedding model via Ollama'
    }
  ];

  /**
   * Get all free models
   */
  static getAll(): FreeModel[] {
    return [...this.models];
  }

  /**
   * Get models by category
   */
  static getByCategory(category: FreeModel['category']): FreeModel[] {
    return this.models.filter(m => m.category === category);
  }

  /**
   * Get models by provider
   */
  static getByProvider(provider: FreeModel['provider']): FreeModel[] {
    return this.models.filter(m => m.provider === provider);
  }

  /**
   * Get best free model for category
   */
  static getBest(category: FreeModel['category']): FreeModel | null {
    const models = this.getByCategory(category);
    if (models.length === 0) return null;
    
    return models.reduce((best, current) => 
      current.quality > best.quality ? current : best
    );
  }

  /**
   * Get model by ID
   */
  static getById(id: string): FreeModel | undefined {
    return this.models.find(m => m.id === id);
  }
}

