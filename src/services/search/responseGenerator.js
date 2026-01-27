const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

class ResponseGenerator {
  async generateResponse(query, category, dbResults, webResults = null) {
    try {
      // If we have web results, format those
      if (webResults) {
        return this.formatWebResults(query, webResults);
      }

      // If we have database results, format based on category
      if (dbResults) {
        switch (category) {
          case 'vehicles':
            return this.formatVehicleResults(dbResults, query);
          case 'real_estate':
            return this.formatRealEstateResults(query, dbResults);
          case 'products':
            return this.formatProductResults(query, dbResults);
          default:
            return this.generateGenericResponse(query, dbResults);
        }
      }

      // If no results
      return {
        message: "I couldn't find any results matching your search.",
        suggestions: "Try using different keywords or broadening your search criteria."
      };
    } catch (error) {
      console.error('Response generation error:', error);
      return {
        message: "I encountered an error while formatting the search results.",
        error: error.message
      };
    }
  }

  formatVehicleResults(results, query) {
    if (!results || !results.length) {
      return {
        message: "I couldn't find any vehicles matching your search criteria.",
        suggestions: "Try using different keywords or check our latest listings."
      };
    }

    // Safely handle potentially undefined properties
    const uniqueVehicles = results.reduce((acc, vehicle) => {
      // Skip invalid entries
      if (!vehicle) return acc;
      
      const key = [
        vehicle.brand || '',
        vehicle.model || '',
        vehicle.year || '',
        vehicle.price || ''
      ].join('-');
      
      if (!acc[key]) {
        acc[key] = vehicle;
      }
      return acc;
    }, {});

    const vehicles = Object.values(uniqueVehicles);
    const uniqueCount = vehicles.length;

    // Safely extract attributes with null checks
    const brands = [...new Set(vehicles.map(v => v?.brand || '').filter(Boolean))];
    const models = [...new Set(vehicles.map(v => v?.model || '').filter(Boolean))];
    const years = [...new Set(vehicles.map(v => v?.year || '').filter(Boolean))].sort();
    const colors = [...new Set(vehicles.map(v => v?.exterior || '').filter(Boolean))];
    const locations = [...new Set(vehicles.map(v => v?.location || '').filter(Boolean))];
    
    // Safely handle price calculations
    const prices = vehicles
      .map(v => parseFloat(v?.price_value || '0'))
      .filter(p => !isNaN(p) && p > 0);
    
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    // Build response with null checks
    let responseText = `I found ${uniqueCount} exciting vehicles that match your search! 🚗\n\n`;

    if (models.length) {
      responseText += `🎯 Available Models:\n`;
      models.forEach(model => {
        responseText += `• ${model}\n`;
      });
    }

    if (years.length) {
      responseText += `\n📅 Model Years: ${Math.min(...years.map(Number))} to ${Math.max(...years.map(Number))}\n`;
    }

    if (colors.length) {
      responseText += `\n🎨 Color Options:\n`;
      colors.forEach(color => {
        responseText += `• ${color}\n`;
      });
    }

    if (prices.length) {
      responseText += `\n💰 Price Range:\n`;
      responseText += `From ${this.formatPrice(minPrice)} to ${this.formatPrice(maxPrice)}\n`;
    }

    if (locations.length) {
      responseText += `\n📍 Available in:\n`;
      locations.slice(0, 3).forEach(location => {
        responseText += `• ${location}\n`;
      });
      if (locations.length > 3) {
        responseText += `• And ${locations.length - 3} more locations\n`;
      }
    }

    responseText += `\n✨ Featured Vehicles:\n`;
    vehicles.slice(0, 3).forEach(vehicle => {
      if (!vehicle) return;
      
      const details = [
        vehicle.year,
        vehicle.brand,
        vehicle.model,
        vehicle.exterior ? `in ${vehicle.exterior}` : '',
        vehicle.price ? `- ${vehicle.price}` : ''
      ].filter(Boolean).join(' ');
      
      const features = [
        vehicle.transmission,
        vehicle.fuel,
        vehicle.condition,
        vehicle.location
      ].filter(Boolean).join(' • ');

      responseText += `\n🚘 ${details}\n`;
      if (features) {
        responseText += `   ${features}\n`;
      }
    });

    // Return standardized response format
    return {
      message: responseText,
      summary: {
        total: uniqueCount,
        models: models,
        years: years.length ? { min: Math.min(...years.map(Number)), max: Math.max(...years.map(Number)) } : null,
        colors: colors,
        locations: locations,
        price_range: prices.length ? { min: minPrice, max: maxPrice } : null
      },
      highlights: vehicles.slice(0, 3).map(vehicle => {
        return {
          id: vehicle.id,
          year: vehicle.year,
          brand: vehicle.brand,
          model: vehicle.model,
          color: vehicle.exterior,
          price: vehicle.price,
          price_value: vehicle.price_value,
          location: vehicle.location,
          image: vehicle.image_url
        };
      }),
      count: uniqueCount
    };
  }

  formatPrice(price) {
    if (!price) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }

  async formatRealEstateResults(query, results) {
    if (!results.length) {
      return {
        message: "I couldn't find any properties matching your search criteria.",
        suggestions: "Try adjusting your location or price range."
      };
    }

    const types = [...new Set(results.map(r => r.property_type))];
    const locations = [...new Set(results.map(r => r.location))];
    const prices = results.map(r => parseFloat(r.price_value)).filter(Boolean);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Generate human-friendly response text
    let responseText = `I found ${results.length} propert${results.length > 1 ? 'ies' : 'y'} that match your search! 🏠\n\n`;
    
    if (types.length) {
      responseText += `🏢 Property Types:\n`;
      types.forEach(type => {
        responseText += `• ${type}\n`;
      });
    }
    
    if (locations.length) {
      responseText += `\n📍 Locations:\n`;
      locations.slice(0, 3).forEach(location => {
        responseText += `• ${location}\n`;
      });
      if (locations.length > 3) {
        responseText += `• And ${locations.length - 3} more locations\n`;
      }
    }
    
    if (prices.length) {
      responseText += `\n💰 Price Range:\n`;
      responseText += `From ${this.formatPrice(minPrice)} to ${this.formatPrice(maxPrice)}\n`;
    }
    
    responseText += `\n✨ Featured Properties:\n`;
    results.slice(0, 3).forEach(property => {
      if (!property) return;
      
      const details = [
        property.property_type,
        property.title,
        property.price ? `- ${property.price}` : ''
      ].filter(Boolean).join(' ');
      
      const features = [
        property.bedrooms ? `${property.bedrooms} bed` : '',
        property.bathrooms ? `${property.bathrooms} bath` : '',
        property.area ? `${property.area}` : '',
        property.location
      ].filter(Boolean).join(' • ');

      responseText += `\n🏡 ${details}\n`;
      if (features) {
        responseText += `   ${features}\n`;
      }
    });

    return {
      message: responseText,
      summary: {
        total_results: results.length,
        property_types: types,
        locations: locations,
        price_range: prices.length ? { min: minPrice, max: maxPrice } : null
      },
      highlights: results.slice(0, 3).map(property => ({
        id: property.id,
        title: property.title,
        price: property.price,
        price_value: property.price_value,
        location: property.location,
        property_type: property.property_type,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        area: property.area,
        image: property.image_url
      }))
    };
  }

  async formatProductResults(query, results) {
    if (!results.length) {
      return {
        message: "I couldn't find any products matching your search criteria.",
        suggestions: "Try using different keywords or check our featured products."
      };
    }

    const categories = [...new Set(results.map(r => r.category))];
    const brands = [...new Set(results.map(r => r.brand).filter(Boolean))];
    const conditions = [...new Set(results.map(r => r.condition).filter(Boolean))];
    const prices = results.map(r => parseFloat(r.price_value)).filter(Boolean);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Generate human-friendly response text
    let responseText = `I found ${results.length} product${results.length > 1 ? 's' : ''} that match your search! 🛍️\n\n`;
    
    if (categories.length) {
      responseText += `📦 Categories:\n`;
      categories.forEach(category => {
        responseText += `• ${category}\n`;
      });
    }
    
    if (brands.length) {
      responseText += `\n🏭 Brands:\n`;
      brands.slice(0, 5).forEach(brand => {
        responseText += `• ${brand}\n`;
      });
      if (brands.length > 5) {
        responseText += `• And ${brands.length - 5} more brands\n`;
      }
    }
    
    if (prices.length) {
      responseText += `\n💰 Price Range:\n`;
      responseText += `From ${this.formatPrice(minPrice)} to ${this.formatPrice(maxPrice)}\n`;
    }
    
    responseText += `\n✨ Featured Products:\n`;
    results.slice(0, 3).forEach(product => {
      if (!product) return;
      
      const details = [
        product.title,
        product.price ? `- ${product.price}` : ''
      ].filter(Boolean).join(' ');
      
      const features = [
        product.condition,
        product.brand,
        product.category
      ].filter(Boolean).join(' • ');

      responseText += `\n🛒 ${details}\n`;
      if (features) {
        responseText += `   ${features}\n`;
      }
    });

    return {
      message: responseText,
      summary: {
        total: results.length,
        categories: categories,
        brands: brands,
        conditions: conditions,
        price_range: prices.length ? { min: minPrice, max: maxPrice } : null
      },
      highlights: results.slice(0, 3).map(product => ({
        id: product.id,
        title: product.title,
        price: product.price,
        price_value: product.price_value,
        category: product.category,
        condition: product.condition,
        brand: product.brand,
        image: product.image_url
      }))
    };
  }

  async formatWebResults(query, webResults) {
    if (!webResults || !webResults.length) {
      return {
        message: "I couldn't find any relevant information for your query.",
        suggestions: "Try rephrasing your question or being more specific.",
        type: "web-search"
      };
    }

    try {
      // Extract and enhance source information
      const sources = await Promise.all(webResults.map(async (result) => {
        const url = new URL(result.url);
        const domain = url.hostname;
        
        // Generate favicon URL
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        // Extract additional metadata
        const metadata = {
          domain: domain,
          path: url.pathname,
          protocol: url.protocol,
          favicon: favicon,
          timestamp: new Date().toISOString()
        };

        return {
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          domain: domain,
          favicon: favicon,
          metadata: metadata
        };
      }));

      // Create a combined content string from all snippets for OpenAI to process
      const combinedContent = webResults.map(result => 
        `Title: ${result.title}\nContent: ${result.snippet}`
      ).join('\n\n');

      // Use OpenAI to generate a comprehensive, markdown-friendly response
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant that synthesizes information from web search results. Create a comprehensive, conversational response that addresses the user's query based on the search results provided.

IMPORTANT GUIDELINES:
1. Use markdown formatting for better readability
2. Use bullet points (•) for lists
3. Use **bold** for emphasis on key points
4. Use ### for section headers when appropriate
5. Include specific details and actionable information
6. Present information in a structured, easy-to-read format
7. Do not mention that you're using search results
8. Make the response informative and helpful
9. Use emojis sparingly but effectively for visual appeal

**MANDATORY Response Structure (ALWAYS follow this exact format):**

1. Bold Intro Line: Start with a single bold line that summarizes your answer.
   IMPORTANT: The # symbol already creates bold formatting. DO NOT use ** around the #.
   CORRECT Format: # Your bold intro line here
   WRONG Format: **# Your bold intro line here** (DO NOT do this)
   (Use # with space, then your text, then a newline. DO NOT add ** before or after the #)

2. **Clear Sections**: Use Markdown headers (##, ###) to organize content into distinct sections.
   - Add short section headers like "## Top Places to Visit" before lists
   - DO NOT use emojis in header lines (##, ###)

3. **Short Paragraphs**: Each paragraph must be 2–4 lines maximum. Break longer content into multiple paragraphs.

4. **Formatting Rules**:
   - Highlight key terms with *bold* (single asterisks)
   - Use bullet points for lists and comparisons
   - Keep paragraphs concise (2–4 lines each)
   - Use emojis (light, tasteful) in content and bullet points, but NOT in header lines (##, ###):
     * ⭐ Highlights
     * 🍽️ Restaurants
     * 🌴 Beaches
     * 🛒 Shopping
     * 🔥 Hot picks
     * 📌 Short notes
     * 👉 Recommendations
     * 🟢 Quick tips
     * add other emojis as needed

5. **Closing Summary**: End with a brief 1–2 line summary without any header. Just plain text.

Format your response in markdown with proper structure.`
          },
          {
            role: "user",
            content: `User query: "${query}"\n\nWeb search results:\n${combinedContent}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      // Extract the generated response
      const responseText = aiResponse.choices[0].message.content;

      return {
        message: responseText,
        type: "web-search",
        sources: sources.slice(0, 5), // Return top 5 sources
        metadata: {
          total_sources: webResults.length,
          query: query,
          generated_at: new Date().toISOString(),
          response_format: "markdown"
        }
      };
    } catch (error) {
      console.error("Error generating web search response:", error);
      
      // Fallback to a simpler response if OpenAI processing fails
      const fallbackSources = await Promise.all(webResults.map(async (result) => {
        const url = new URL(result.url);
        const domain = url.hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        return {
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          domain: domain,
          favicon: favicon,
          metadata: {
            domain: domain,
            path: url.pathname,
            protocol: url.protocol,
            favicon: favicon,
            timestamp: new Date().toISOString()
          }
        };
      }));

      return {
        message: `Based on the search results, here's what I found:\n\n${webResults[0].snippet || 'No additional information available.'}`,
        type: "web-search",
        sources: fallbackSources.slice(0, 5),
        metadata: {
          total_sources: webResults.length,
          query: query,
          generated_at: new Date().toISOString(),
          response_format: "fallback"
        }
      };
    }
  }
  

  async generateGenericResponse(query, results) {
    if (!results || !results.length) {
      return {
        message: "I couldn't find any relevant information for your query.",
        suggestions: "Try using different keywords or check our featured content."
      };
    }
    
    return {
      message: `Found ${results.length} results for your search.`,
      summary: {
        total: results.length
      },
      highlights: results.slice(0, 3).map(result => ({
        id: result.id,
        title: result.title,
        description: result.description
      }))
    };
  }

  extractMetadatFromRespose(response) {
    if(response.type === 'ai_chat') {
      return response.message;
    }else if(response.type === 'database_search') {
      let resultString = "";
      response.hids.forEach((item, index) => {
        // Determine the item type based on category
        const itemType = response.category;
        resultString += `${itemType} ${index + 1}:\n`;
        
        // Excluded fields
        const excludedFields = ['id', 'hid', 'similarity', '_matchedFilters', '_boost', 'final_score'];
        
        // Get all keys from the item
        Object.keys(item).forEach(key => {
          if (!excludedFields.includes(key)) {
            // Handle special case for price values only
            const value = key.includes('price') && item[key] ? '$' + item[key] : (item[key] || 'N/A');
            resultString += `${key}: ${value}\n`;
          }
        });
        
        resultString += '\n';
      });
      
      
      return resultString;
      
    }else if(response.type === 'web_search') {
      return response.message;
    }else{
      return "No metadata available for this response type.";
    }

  }


}

module.exports = new ResponseGenerator(); 