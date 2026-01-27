const { gql } = require('apollo-server-express');

const typeDefs = gql`
    scalar JSON

    type Listing {
      id: ID!
      user_id: String!
      category: String!
      title: String!
      description: String
      price: Float!
      phone_number: String
      location: JSON
      media: JSON
      basic_attributes: JSON
      attributes: JSON
      status: String
      boost: Int
      boost_expire: String
      created_at: String
      updated_at: String
      is_verified: Boolean
    }

  type Vehicle {
    hid: String!
    category: String
    brand: String
    model: String
    year: Int
    engine: String
    condition: String
    mileage_value: Float
    mileage_unit: String
    exterior_color: String
    interior_color: String
    passengers: Int
    fuel_type: String
    transmission: String
    traction: String
    price: Float
    price_currency: String
    location: String
    city: String
    province: String
    coordinates: String
    images_url: [String]
    detail_url: String
    accessories: String
    source: String
    created_at: String
    updated_at: String
  }

  type RealEstate {
    hid: String!
    category: String
    title: String
    price: Float
    listing_type: String
    bedrooms: Int
    bathrooms: Float
    area: Float
    location: String
    coordinates: String
    description: String
    features: String
    images_url: [String]
    detail_url: String
    source: String
    updated_at: String
  }

  type Product {
    hid: String!
    title: String
    category: String
    brand: String
    price: Float
    price_currency: String
    availability: String
    images_url: [String]
    detail_url: String
    location: String
    coordinates: String
    source: String
    created_at: String
    updated_at: String
  }

  union SearchResult = Vehicle | RealEstate | Product

  type SearchResponse {
    items: [SearchResult!]!
    totalCount: Int!
    page: Int!
    totalPages: Int!
  }
  
  type ListingResponse {
    items: [Listing!]!
    totalCount: Int!
    page: Int!
    totalPages: Int!
  }

  type Query {
    getListingsByIds(listingIds: [String!]!): ListingResponse!
    getItemsByHids(hids: [String!]!, category: String!): SearchResponse!
    getProductByHid(hid: String!): Product
    getProductsByHids(hids: [String!]!): [Product!]!
    getItemsByCategoryAndHids(category: String!, hids: [String!]!): [SearchResult!]!
  }
`;

module.exports = typeDefs; 