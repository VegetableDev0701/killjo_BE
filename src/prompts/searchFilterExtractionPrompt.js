const  {defaultCategories} = require('../data/categoryData');

function getInstruction(category) {
    return `You are a smart assistant that extracts structured search filter values from natural language queries for a Dominican Republic marketplace database.

Your goal is to analyze the user's message and extract data for ${category} search and return JSON format response.

---

**RESPONSE FORMAT**

{

`
}

function getExtractionRules() {
    return `
}

---

**DATA EXTRACTION RULES**

- Return the result as a valid JSON object with all keys from RESPONSE FORMAT.
- Fix any typos/misspellings (e.g. 'mercedez'→'mercedes')
- For Ranges, Extract value in "min-max", "min-" or "-max" format depending on min, max can be determined. 
- For One of [], The value should match one of the options in the array.
- For Arrays, Extract one or multiple options matching the array.
- Except for Arrays, all other values should be a String.
- If a value is not clearly provided or implied, set it to null.

---

`;
}

function addSortingRule() {
    return `
**SORTING LOGIC FOR DATABASE_SEARCH:**

-If user mentions "affordable", "cheap", "luxury", "premium" or anything of similar that indicates users spending preferences, add these filters in RESPONSE JSON 

"sort_by": 'price'
"sort_order": 'asc' or 'desc' (asc for cheap/affordable, desc for luxury/premium) 

Return **ONLY** the JSON object.
`;
}

const filterJSONFormat = {}

filterJSONFormat['vehicles'] =`
"brand": Brand name (e.g. Toyota, Kia, Hyundai, Honda, Nissan, Ford, Chevrolet, Mercedes, Mazda, Jeep, Lexus, Suzuki, Isuzu, Mitsubishi, Jetour, Changan, Daihatsu, BMW),
"model": Model name (e.g. Corolla, CR-V, Sorento, Santa Fe, Tucson, RAV4, Explorer, Sportage, Civic, Sonata, Escape, Hilux, Corolla, 4Runner) Fix model name with correct One, G Wagon => G-Class,
"modelArray": Array of Model names that contains different possible formats/corrections of the model name (e.g. C-HR -> ['C-HR', 'CHR'], Class c -> ['C-Class', 'C Class', 'Class C'], G Wagon(its a wrong model name) -> ['G Wagon', 'G-Class','G Class', 'Class G'])
"year": Range of years (e.g. "2020-2025"),
"mileage": Range of mileage (e.g. "-20000"),
"fuel_type": One of ['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng'],
"transmission": One of ['manual', 'automatic', 'cvt', 'semi-automatic'],
"engine_size": Engine size (e.g. "2.0L"),
"color": English color (e.g. "red"),
"condition": One of ['new', 'used', 'refurbished', 'salvage'],
"body_type": One of ['sedan', 'suv', 'hatchback', 'wagon', 'coupe', 'convertible', 'pickup', 'van', 'truck'],
"doors": Range of door number (e.g. "4-6"),
"seats": Range of passenger seat (e.g. "4-"),
"features": Array of Features from ['ac', 'bluetooth', 'backup_camera', 'gps', 'leather_seats', 'sunroof', 'alloy_wheels', 'cruise_control'],
"engine": Engine Power (e.g. "2800cc 4 cylinder"),
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['real_estate'] =`
"listing_type": One of ['Rent', 'Sell'],
"property_type": One of ['apartment', 'house', 'villa', 'condo', 'townhouse', 'land', 'commercial', 'office', 'warehouse', 'shop'],
"bedrooms": Range of bedroom number (e.g. "3-4"),
"bathrooms": Range of bathroom number (e.g. "2-"),
"area_size": Range of area_size  (e.g. "1250-1500"),
"area_unit": One of ['sq_ft', 'sq_m', 'acres', 'hectares'],
"floor_number": Range of floor number,
"total_floors": Range of total floor count in building,
"parking_spaces": Range of parking space,
"furnished": One of ['furnished', 'semi_furnished', 'unfurnished'],
"condition": One of ['new', 'excellent', 'good', 'fair', 'needs_renovation'],
"amenities": Array of amenities from ['pool', 'gym', 'garden', 'balcony', 'elevator', 'security', 'parking', 'ac', 'heating', 'internet', 'cable_tv'],
"location_type": One of ['residential', 'commercial', 'mixed_use', 'industrial'],
"view": One of ['city_view', 'sea_view', 'mountain_view', 'garden_view', 'street_view'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['electronics'] = `
"brand": Brand name (e.g. "Apple"),
"category": One of ['smartphones', 'laptops', 'tablets', 'watches', 'washing_machines', 'fans', 'televisions', 'speakers', 'refrigerators', 'air_conditioners', 'microwaves', 'audio_systems', 'video_game_consoles', 'routers', 'security_cameras', 'bluetooth_headphones', 'smart_home_devices', 'inverters', 'power_banks', 'projectors', 'car_audio', 'drones', 'GPS_devices', 'surge_protectors', 'other'],
"model": Model name (e.g. "iPhone 14"),
"condition": One of ['new', 'like_new', 'excellent', 'good', 'fair', 'poor'],
"warranty": One of ['no_warranty', 'seller_warranty', 'manufacturer_warranty', 'extended_warranty'],
"storage": Storage Capacity (e.g. '256GB', '1TB'),
"ram": RAM Size (e.g. "8GB", "12GB"),
"processor": "Intel i7",
"screen_size": "15.6",
"color": English color (e.g. "black"),
"connectivity": Array of connectivity from ['wifi', 'bluetooth', '4g', '5g', 'nfc', 'gps', 'usb_c', 'hdmi', 'ethernet'],
"accessories": Array of accessories from ['charger', 'cable', 'case', 'screen_protector', 'headphones', 'stylus', 'keyboard', 'mouse'],
"original_box": true or false,
"receipt": true or false,
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['fashion'] = `
"brand": Brand name (e.g. "Adidas"),
"category": One of ['shirts', 'pants', 'dresses', 'shoes', 'bags', 'accessories', 'jewelry', 'watches', 'sunglasses', 'hats', 'scarves'],
"size": Size (e.g. 'S', 'M', 'XL', '42', '43'),
"color": Color (e.g. "red"),
"material": e.g. "leather",
"condition": One of ['new_with_tags', 'new_without_tags', 'excellent', 'good', 'fair', 'poor'],
"gender": One of ['men', 'women', 'unisex', 'kids'],
"season": One of ['spring', 'summer', 'fall', 'winter', 'all_season'],
"style": One of ['casual', 'formal', 'sporty', 'vintage', 'bohemian', 'minimalist', 'streetwear', 'elegant'],
"original_price": Range of price (e.g. "1000-2000"),
"authenticity": One of ['authentic', 'replica', 'inspired', 'unknown'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['foods'] = `
"category": One of ['snacks', 'beverages', 'fresh_produce', 'meat_and_poultry', 'dairy_products', 'bakery_items', 'canned_goods', 'frozen_foods', 'grains_and_pasta', 'condiments_and_sauces', 'organic_and_health', 'gourmet', 'other'],
"brand": Brand name (e.g."Nestlé"),
"package_size": Size in weight or volume (e.g. "500g", "5L"),
"expiration_date": "yyyy-mm-dd",
"dietary_info": Array of dietary terms from ['vegan', 'vegetarian', 'gluten_free', 'halal', 'kosher', 'organic', 'non_gmo', 'low_sugar'],
"ingredients": Ingredients used,
"nutrition_facts": Nutrition info (e.g. "low sugar, 100 calories"),
"flavor": Flavor (e.g. "BBQ", "Vanilla"),
"condition": One of ['fresh', 'frozen', 'refrigerated'],
"storage_instructions": e.g. "store in a cool dry place",
"delivery_available": true or false,
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['furniture'] = `
"category": One of ['sofa', 'bed', 'table', 'chair', 'cabinet', 'shelf', 'desk', 'mattress', 'appliance', 'decor', 'lighting', 'rug'],
"material": (e.g "wood"),
"color": (e.g. "white"),
"condition": One of ['new', 'excellent', 'good', 'fair', 'needs_repair'],
"dimensions": Dimensions (e.g. "120x60x75 cm"),
"room": One of ['living_room', 'bedroom', 'kitchen', 'dining_room', 'office', 'bathroom', 'outdoor', 'garage'],
"style": One of ['modern', 'traditional', 'vintage', 'industrial', 'scandinavian', 'minimalist', 'bohemian', 'luxury'],
"assembly_required": true or false,
"warranty": One of ['no_warranty', 'seller_warranty', 'manufacturer_warranty'],
"power_consumption": (e.g. "1000W"),
"features": Array of features from ['adjustable', 'foldable', 'extendable', 'storage', 'wheels', 'remote_control', 'smart_features'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['books'] = `
"title": Book Title (e.g. "Atomic Habits"),
"author": Author name,
"publisher": Publisher name,
"isbn": "9783161484100",
"language": "English",
"format": One of ['hardcover', 'paperback', 'ebook', 'audiobook', 'magazine', 'dvd', 'bluray', 'cd', 'vinyl'],
"genre": One of ['fiction', 'non_fiction', 'mystery', 'romance', 'sci_fi', 'fantasy', 'biography', 'history', 'science', 'self_help', 'cookbook', 'travel', 'children', 'academic', 'textbook'],
"condition": One of ['new', 'like_new', 'excellent', 'good', 'fair', 'poor'],
"pages": Range of page number (e.g. "100-200"),
"publication_year": Range of publication year (e.g. "2009-"),
"edition": Edition name (e.g. '1st', '2nd', 'special'),
"signed": true or false,
"original_price": Range of price (e.g. "1000-2000"),
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['sports'] = `
"sport": One of ['football', 'basketball', 'tennis', 'golf', 'swimming', 'cycling', 'running', 'gym', 'yoga', 'hiking', 'fishing', 'camping', 'skiing', 'snowboarding', 'surfing', 'other'],
"brand": Brand name (e.g. "Nike"),
"model": Model name (e.g. "Air Zoom Pegasus")
"condition": One of ['new', 'excellent', 'good', 'fair', 'needs_repair'],
"size": Size (e.g. 'S', 'M', 'XL', '42', '43'),
"material": e.g. "rubber"
"color": e.g. "black" 
"weight": e.g "1.5kg"
"features": Array of features from ['adjustable', 'foldable', 'portable', 'waterproof', 'shock_absorbing', 'anti_slip', 'ventilated', 'padded'],
"warranty": One of ['no_warranty', 'seller_warranty', 'manufacturer_warranty'],
"usage_level": One of ['beginner', 'intermediate', 'advanced', 'professional'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['services'] = `
"service_type": Array of matching service types from ['repair', 'maintenance', 'cleaning', 'consultation', 'tutoring', 'design', 'photography', 'catering', 'transport', 'beauty', 'health', 'legal', 'accounting', 'it', 'other'],
"experience_years": Range of experience years (e.g. "5-10"),
"certification": Certification (e.g. "Certified HVAC Technician"),
"availability": One of ['immediate', 'within_week', 'within_month', 'by_appointment'],
"service_area": Service area location (e.g. "Santo Domingo"),
"languages": Array of languages ['english', 'spanish', 'arabic', 'french', 'german', 'chinese', 'other'],
"payment_methods": Array of payment methods from ['cash', 'card', 'bank_transfer', 'paypal', 'crypto'],
"insurance": true or false,
"warranty": true or false,
"emergency_service": true or false,
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['pets'] = `
"animal_type": One of ['dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'guinea_pig', 'reptile', 'horse', 'farm_animal', 'exotic', 'other'],
"breed": Animal breed (e.g. "Golden Retriever", "Persian"),
"age": Range of Age in months (e.g. "24-"),
"gender": One of ['male', 'female', 'unknown'],
"color": Color or markings (e.g. "brown with white spots"),
"size": One of ['tiny', 'small', 'medium', 'large', 'giant'],
"condition": One of ['healthy', 'needs_attention', 'special_needs', 'senior'],
"vaccinated": true or false,
"neutered": true or false,
"microchipped": true or false,
"trained": true or false,
"good_with": Array of compatible types ['children', 'other_dogs', 'other_cats', 'strangers', 'elderly'],
"special_needs": Special needs or care instructions (e.g. "requires daily medication"),
"reason_for_sale": One of ['moving', 'allergies', 'no_time', 'financial', 'adoption', 'litter', 'other'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['jobs'] = `
"job_type": One of ['full_time', 'part_time', 'contract', 'freelance', 'internship', 'temporary', 'remote', 'hybrid'],
"industry": One of ['technology', 'healthcare', 'education', 'finance', 'retail', 'manufacturing', 'marketing', 'sales', 'customer_service', 'design', 'writing', 'consulting', 'hospitality', 'construction', 'transportation', 'other'],
"experience_level": One of ['entry_level', 'junior', 'mid_level', 'senior', 'executive', 'internship'],
"salary_min": Range of minimum salary (e.g. "1000-"),
"salary_max": Range of maximum salary (e.g. "-7000"),
"salary_type": One of ['hourly', 'monthly', 'yearly', 'project_based', 'commission'],
"location_type": One of ['onsite', 'remote', 'hybrid', 'travel'],
"skills_required": Array of required skills ['javascript', 'python', 'java', 'react', 'nodejs', 'sql', 'aws', 'docker', 'kubernetes', 'agile', 'scrum', 'project_management', 'sales', 'marketing', 'design', 'writing', 'customer_service'],
"education_level": One of ['high_school', 'associate', 'bachelor', 'master', 'phd', 'certification', 'none_required'],
"benefits": Array of benefits ['health_insurance', 'dental_insurance', 'vision_insurance', 'retirement_plan', 'paid_time_off', 'flexible_hours', 'remote_work', 'professional_development', 'gym_membership', 'meal_allowance'],
"start_date": Start date (e.g. "Immediate", "Next Month"),
"contract_duration": Contract duration (e.g. "3 months", "1 year"),
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['collectibles'] = `
"category": One of ['stamps', 'coins', 'art', 'comics', 'cards', 'figures', 'dolls', 'toys', 'books', 'records', 'watches', 'jewelry', 'furniture', 'clothing', 'militaria', 'sports_memorabilia', 'other'],
"era": One of ['ancient', 'medieval', 'renaissance', '18th_century', '19th_century', 'early_20th', 'mid_20th', 'late_20th', 'modern', 'contemporary'],
"condition": One of ['mint', 'near_mint', 'excellent', 'very_good', 'good', 'fair', 'poor'],
"rarity": One of ['common', 'uncommon', 'rare', 'very_rare', 'ultra_rare', 'legendary'],
"authenticity": One of ['authentic', 'reproduction', 'replica', 'unknown', 'certified'],
"certification": Certification or authentication details (e.g. "PSA Certified", "COA included"),
"provenance": Provenance or history (e.g. "Passed down from grandparents", "Museum origin"),
"materials": Materials used (e.g. "Gold, Silver, Paper"),
"dimensions": Dimensions (e.g. "10x15 cm", "2 inches"),
"weight": Weight (e.g. "50g"),
"original_price": Range of original price (e.g. "100-500"),
"appraisal_value": Range of appraisal value (e.g. "500-1000"),
"storage_condition": One of ['display_case', 'safe', 'climate_controlled', 'regular_storage', 'needs_attention'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['health'] = `
"category": One of ['medical_equipment', 'beauty_products', 'skincare', 'haircare', 'makeup', 'fragrances', 'vitamins', 'supplements', 'fitness_equipment', 'wellness_products', 'dental_care', 'first_aid', 'mobility_aids', 'other'],
"brand": Brand name (e.g. "Johnson & Johnson", "L'Oreal"),
"condition": One of ['new', 'unopened', 'lightly_used', 'used', 'expired'],
"expiration_date": Expiration date (e.g. "2024-12-31"),
"size": Size description (e.g. "100ml", "50 tablets", "Large"),
"skin_type": One of ['normal', 'dry', 'oily', 'combination', 'sensitive', 'acne_prone', 'mature'],
"skin_concerns": Array of skin concerns ['acne', 'aging', 'dark_spots', 'dryness', 'oiliness', 'redness', 'scars', 'wrinkles', 'none'],
"ingredients": Key ingredients (e.g. "Hyaluronic acid, Vitamin C"),
"cruelty_free": true or false,
"vegan": true or false,
"organic": true or false,
"prescription_required": true or false,
"usage_instructions": Usage instructions (e.g. "Apply twice daily after cleansing"),
"warranty": One of ['no_warranty', '30_days', '90_days', '1_year', 'lifetime'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['education'] = `
"category": One of ['online_course', 'in_person_course', 'tutoring', 'workshop', 'seminar', 'certification', 'degree_program', 'language_learning', 'music_lessons', 'art_classes', 'cooking_classes', 'fitness_training', 'business_training', 'technical_training', 'other'],
"subject": One of ['mathematics', 'science', 'language', 'history', 'literature', 'art', 'music', 'cooking', 'fitness', 'business', 'technology', 'health', 'finance', 'marketing', 'design', 'photography', 'writing', 'other'],
"level": One of ['beginner', 'intermediate', 'advanced', 'expert', 'all_levels'],
"format": One of ['one_on_one', 'group', 'self_paced', 'live_online', 'recorded', 'hybrid'],
"duration": Duration of the course (e.g. "2 hours", "8 weeks", "6 months"),
"schedule": Class schedule (e.g. "Mondays 6-8 PM", "Flexible"),
"location": Location (e.g. "Online", "Downtown", "Home visits"),
"instructor_qualifications": Instructor qualifications (e.g. "Certified ESL teacher", "PhD in Physics"),
"max_students": Range of maximum students (e.g. "10-25"),
"materials_included": true or false,
"certificate": true or false,
"prerequisites": Prerequisites (e.g. "Basic math knowledge", "No prior experience"),
"languages": Array of languages ['english', 'spanish', 'arabic', 'french', 'german', 'chinese', 'other'],
"refund_policy": One of ['no_refunds', 'full_refund', 'partial_refund', 'credit_only'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['events'] = `
"event_type": One of ['concert', 'sports', 'theater', 'comedy', 'workshop', 'conference', 'festival', 'exhibition', 'party', 'wedding', 'birthday', 'corporate', 'charity', 'other'],
"event_date": Event date (e.g. "2024-12-25"),
"event_time": Event time (e.g. "7:00 PM"),
"venue": Venue or location of the event (e.g. "Madison Square Garden", "Downtown Park"),
"city": City of the event (e.g. "New York", "Los Angeles"),
"ticket_type": One of ['general_admission', 'vip', 'premium', 'backstage', 'meet_greet', 'early_bird', 'student', 'senior', 'child', 'other'],
"seating_section": Seating section (e.g. "Section A, Row 5, Seat 12"),
"quantity": Range of required tickets (e.g. "9-10"),
"face_value": Range of ticket face value (e.g. "50-150"),
"transferable": true or false,
"digital_ticket": true or false,
"parking_included": true or false,
"food_beverage": true or false,
"age_restriction": Age restriction (e.g. "18+", "All ages"),
"dress_code": Dress code (e.g. "Formal", "Casual", "Costume"),
"refund_policy": One of ['no_refunds', 'full_refund', 'partial_refund', 'exchange_only'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['tools'] = `
"category": One of ['hand_tools', 'power_tools', 'garden_tools', 'automotive_tools', 'construction_equipment', 'woodworking_tools', 'plumbing_tools', 'electrical_tools', 'welding_equipment', 'measuring_tools', 'safety_equipment', 'cleaning_equipment', 'other'],
"brand": Brand name (e.g. "DeWalt", "Makita", "Craftsman"),
"model": Model name or number (e.g. "XR20", "DCD996B"),
"condition": One of ['new', 'like_new', 'excellent', 'good', 'fair', 'needs_repair'],
"power_source": One of ['manual', 'electric', 'battery', 'gas', 'pneumatic', 'hydraulic', 'solar'],
"voltage": Voltage (e.g. "120V", "18V"),
"battery_type": Battery type (e.g. "Li-ion", "NiCd"),
"weight": Weight of the tool (e.g. "2.5kg", "5lbs"),
"dimensions": Dimensions (e.g. "30x15x10 cm"),
"warranty": One of ['no_warranty', '30_days', '90_days', '1_year', 'lifetime'],
"accessories_included": Array of included accessories ['case', 'manual', 'batteries', 'charger', 'bits', 'blades', 'safety_gear', 'spare_parts'],
"safety_features": Array of safety features ['safety_switch', 'guard', 'emergency_stop', 'overload_protection', 'thermal_protection', 'dust_collection'],
"usage_hours": Range of usage hours (e.g. "50", "200"),
"maintenance_history": Description of past maintenance (e.g. "Serviced quarterly", "Never maintained"),
"rental_available": true or false,
"delivery_available": true or false,
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['vehicle_parts'] = `
"condition": One of ['new', 'Used(Good)', 'Used(For Parts)'],
"part_type": One of ['Engine & Transmission', 'Tires & Rims', 'Lights & Mirrors', 'Batteries', 'Suspension & Brakes', 'Interior (Seats, Mats, etc.)', 'Audio & Multimedia', 'Security (GPS, Alarms)', 'Other'],
"compatible_with": Compitibility with a product (e.g. "Compitable with Toyota CHR"),
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


filterJSONFormat['others'] = `
"category": Category of the product (e.g. "toy", "flower"),
"product_type": Product Type/name (e.g "roses", "flower vase"),
"condition": One of ['new', 'used', 'refurbished'],
"budget": Range of budget (e.g. "1000-2000"),
"budget_currency": One of ['USD', 'DOP'],
"location": Location like district, city, state,  etc (e.g. 'Reparto Universitario, Santiago de los Caballeros, Santiago'),
"city": City name (e.g. 'Santo Domingo', 'Puerto Plata', 'La Romana')
`;


function generatePrompts(category) {
    return getInstruction(category) + filterJSONFormat[category] + getExtractionRules() + addSortingRule();
}

const searchFilterExtractionPrompt = {};
for (const category of defaultCategories) {
    searchFilterExtractionPrompt[category.category_key] = generatePrompts(category.category_key);
}
searchFilterExtractionPrompt['others'] = generatePrompts('others');

module.exports = {
    searchFilterExtractionPrompt,
}
