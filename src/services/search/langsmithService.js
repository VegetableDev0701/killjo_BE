const { OpenAI } = require('openai');
const { LangChainTracer } = require('langsmith');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { PromptTemplate } = require('langchain/prompts');
const { RunnableSequence } = require('langchain/schema/runnable');
const { StringOutputParser } = require('langchain/schema/output_parser');
const { pool } = require('../../db');
const { redisService } = require('../redisService');

// Initialize OpenAI and LangSmith
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tracer = new LangChainTracer({
  projectName: "nodo-marketplace-search",
  apiKey: process.env.LANGSMITH_API_KEY,
});

class LangSmithSearchService {
  constructor() {
    this.model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize the RAG chain
    this.ragChain = this.initializeRAGChain();
  }

  async initializeRAGChain() {
    // Create the prompt template for search intent extraction
    const intentPrompt = PromptTemplate.fromTemplate(`
      You are a search assistant for a Dominican Republic marketplace.
      Analyze the user's query and extract search intent and parameters.
      
      User Query: {query}
      
      Extract and return a JSON object with:
      {
        "category": "vehicles|products|real_estate",
        "intent": "search|question|filter",
        "parameters": {
          "filters": {},
          "keywords": [],
          "sort": null
        },
        "confidence": 0.0-1.0
      }
    `);

    // Create the prompt template for search result generation
    const responsePrompt = PromptTemplate.fromTemplate(`
      You are a helpful marketplace assistant. Given the search results and user query,
      generate a natural, helpful response.
      
      User Query: {query}
      Search Results: {results}
      Category: {category}
      
      Generate a response that:
      1. Acknowledges the user's query
      2. Summarizes the key findings
      3. Highlights relevant details
      4. Suggests next steps if needed
      
      Response should be in the same language as the query.
    `);

    // Build the RAG chain
    return RunnableSequence.from([
      {
        query: (input) => input.query,
        category: (input) => input.category,
      },
      intentPrompt,
      this.model,
      new StringOutputParser(),
      async (intentJson) => {
        const intent = JSON.parse(intentJson);
        // Use the extracted intent to search the database
        const results = await this.searchDatabase(intent);
        return {
          query: intent.query,
          category: intent.category,
          results: results,
        };
      },
      responsePrompt,
      this.model,
      new StringOutputParser(),
    ]);
  }

  async searchDatabase(intent) {
    const { category, parameters } = intent;
    const { filters, keywords, sort } = parameters;

    // Build the SQL query based on the extracted parameters
    const query = await this.buildSearchQuery(category, filters, keywords, sort);
    
    // Execute the query with tracing
    const trace = await tracer.startTrace({
      name: "database_search",
      inputs: { category, filters, keywords, sort },
    });

    try {
      const client = await pool.connect();
      const result = await client.query(query.text, query.values);
      await trace.end({ outputs: { count: result.rowCount } });
      return result.rows;
    } catch (error) {
      await trace.end({ error });
      throw error;
    }
  }

  async buildSearchQuery(category, filters, keywords, sort) {
    // Implementation similar to existing queryGenerator but with LangSmith tracing
    const trace = await tracer.startTrace({
      name: "build_search_query",
      inputs: { category, filters, keywords, sort },
    });

    try {
      // Reuse existing query generation logic but add tracing
      const query = await queryGenerator.buildValidatedSQL(
        category,
        filters,
        keywords,
        20, // limit
        0   // offset
      );

      await trace.end({ outputs: { query: query.text } });
      return query;
    } catch (error) {
      await trace.end({ error });
      throw error;
    }
  }

  async processSearch(query, category = null) {
    const trace = await tracer.startTrace({
      name: "process_search",
      inputs: { query, category },
    });

    try {
      // Run the RAG chain
      const result = await this.ragChain.invoke({
        query,
        category: category || "auto", // auto-detect if not specified
      });

      await trace.end({ outputs: { result } });
      return result;
    } catch (error) {
      await trace.end({ error });
      throw error;
    }
  }
}

module.exports = new LangSmithSearchService(); 