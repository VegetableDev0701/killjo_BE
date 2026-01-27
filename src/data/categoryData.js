const defaultCategories = [
    {
        category_key: 'vehicles',
        display_name: 'Vehicles & Cars',
        description: 'Cars, motorcycles, trucks, and other vehicles',
        icon: '🚗',
        color: '#3B82F6',
        sort_order: 1,
        basic_attributes: {},
        attributes: {
            brand: {
                type: "string",
                required: true,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Toyota, Honda, BMW...", es: "Toyota, Honda, BMW..." }
            },
            model: {
                type: "string",
                required: true,
                label: { en: "Model", es: "Modelo" },
                placeholder: { en: "Corolla, Civic, X5...", es: "Corolla, Civic, X5..." }
            },
            year: { type: "number", required: true, label: { en: "Year", es: "Año" }, min: 1900, max: 2030 },
            mileage: { type: "number", required: true, label: { en: "Mileage (km)", es: "Kilometraje (km)" }, min: 0 },
            fuel_type: {
                type: "enum",
                required: true,
                label: { en: "Fuel Type", es: "Tipo de combustible" },
                options: [
                    { en: "petrol", es: "gasolina" },
                    { en: "diesel", es: "diésel" },
                    { en: "electric", es: "eléctrico" },
                    { en: "hybrid", es: "híbrido" },
                    { en: "lpg", es: "GLP" },
                    { en: "cng", es: "GNC" }
                ]
            },
            transmission: {
                type: "enum",
                required: true,
                label: { en: "Transmission", es: "Transmisión" },
                options: [
                    { en: "manual", es: "manual" },
                    { en: "automatic", es: "automática" },
                    { en: "cvt", es: "CVT" },
                    { en: "semi-automatic", es: "semiautomática" }
                ]
            },
            engine_size: {
                type: "string",
                required: false,
                label: { en: "Engine Size", es: "Cilindrada" },
                placeholder: { en: "1.6L, 2.0L...", es: "1.6L, 2.0L..." }
            },
            color: { type: "string", hidden: true, required: false, label: { en: "Color", es: "Color" } },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "used", es: "usado" },
                    { en: "refurbished", es: "reacondicionado" },
                    { en: "salvage", es: "siniestrado" }
                ]
            },
            body_type: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Body Type", es: "Tipo de carrocería" },
                options: [
                    { en: "sedan", es: "sedán" },
                    { en: "suv", es: "SUV" },
                    { en: "hatchback", es: "hatchback" },
                    { en: "wagon", es: "familiar" },
                    { en: "coupe", es: "coupé" },
                    { en: "convertible", es: "convertible" },
                    { en: "pickup", es: "pickup" },
                    { en: "van", es: "furgoneta" },
                    { en: "truck", es: "camión" }
                ]
            },
            doors: { type: "number", hidden: true, required: false, label: { en: "Number of Doors", es: "Número de puertas" }, min: 2, max: 8 },
            seats: { type: "number", hidden: true, required: false, label: { en: "Number of Seats", es: "Número de asientos" }, min: 2, max: 40 },
            features: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Features", es: "Características" },
                options: [
                    { en: "ac", es: "aire acondicionado" },
                    { en: "bluetooth", es: "bluetooth" },
                    { en: "backup camera", es: "cámara de reversa" },
                    { en: "gps", es: "GPS" },
                    { en: "leather seats", es: "asientos de cuero" },
                    { en: "sunroof", es: "techo solar" },
                    { en: "alloy wheels", es: "llantas de aleación" },
                    { en: "cruise control", es: "control de crucero" }
                ]
            }
        }
        ,
        search_fields: ['brand', 'model', 'fuel_type', 'transmission', 'condition', 'body_type']
    },
    {
        category_key: 'real_estate',
        display_name: 'Real Estate',
        description: 'Houses, apartments, land, and commercial properties',
        icon: '🏠',
        color: '#10B981',
        sort_order: 2,
        basic_attributes: {
            listing_type: {
                type: "enum",
                required: true,
                label: { en: "Listing Type", es: "Tipo de anuncio" },
                options: [
                    { en: "Rent", es: "Alquilar" },
                    { en: "Sell", es: "Vender" }
                ]
            }
        },
        attributes: {
            property_type: {
                type: "enum",
                required: true,
                label: { en: "Property Type", es: "Tipo de propiedad" },
                options: [
                    { en: "apartment", es: "apartamento" },
                    { en: "house", es: "casa" },
                    { en: "villa", es: "villa" },
                    { en: "condo", es: "condominio" },
                    { en: "townhouse", es: "casa adosada" },
                    { en: "land", es: "terreno" },
                    { en: "commercial", es: "comercial" },
                    { en: "office", es: "oficina" },
                    { en: "warehouse", es: "almacén" },
                    { en: "shop", es: "tienda" }
                ]
            },
            bedrooms: { type: "number", required: false, label: { en: "Bedrooms", es: "Dormitorios" }, min: 0, max: 20 },
            bathrooms: { type: "number", required: false, label: { en: "Bathrooms", es: "Baños" }, min: 0, max: 20 },
            area_size: { type: "number", required: false, label: { en: "Area Size (sq ft)", es: "Tamaño del área (pies²)" }, min: 0 },
            area_unit: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Area Unit", es: "Unidad de área" },
                options: [
                    { en: "sq ft", es: "pies²" },
                    { en: "sq m", es: "m²" },
                    { en: "acres", es: "acres" },
                    { en: "hectares", es: "hectáreas" }
                ]
            },
            floor_number: { type: "number", hidden: true, required: false, label: { en: "Floor Number", es: "Número de piso" }, min: -10, max: 200 },
            total_floors: { type: "number", hidden: true, required: false, label: { en: "Total Floors", es: "Pisos totales" }, min: 1, max: 200 },
            parking_spaces: { type: "number", hidden: true, required: false, label: { en: "Parking Spaces", es: "Espacios de estacionamiento" }, min: 0, max: 20 },
            furnished: {
                type: "enum",
                required: true,
                label: { en: "Furnished Status", es: "Estado de amueblado" },
                options: [
                    { en: "furnished", es: "amueblado" },
                    { en: "semi furnished", es: "semi-amueblado" },
                    { en: "unfurnished", es: "sin amueblar" }
                ]
            },
            condition: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "regular" },
                    { en: "needs renovation", es: "necesita renovación" }
                ]
            },
            amenities: {
                type: "array",
                required: false,
                label: { en: "Amenities", es: "Comodidades" },
                options: [
                    { en: "pool", es: "piscina" },
                    { en: "gym", es: "gimnasio" },
                    { en: "garden", es: "jardín" },
                    { en: "balcony", es: "balcón" },
                    { en: "elevator", es: "ascensor" },
                    { en: "security", es: "seguridad" },
                    { en: "parking", es: "estacionamiento" },
                    { en: "ac", es: "aire acondicionado" },
                    { en: "heating", es: "calefacción" },
                    { en: "internet", es: "internet" },
                    { en: "cable tv", es: "televisión por cable" }
                ]
            },
            location_type: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Location Type", es: "Tipo de ubicación" },
                options: [
                    { en: "residential", es: "residencial" },
                    { en: "commercial", es: "comercial" },
                    { en: "mixed use", es: "uso mixto" },
                    { en: "industrial", es: "industrial" }
                ]
            },
            view: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "View", es: "Vista" },
                options: [
                    { en: "city view", es: "vista a la ciudad" },
                    { en: "sea view", es: "vista al mar" },
                    { en: "mountain view", es: "vista a la montaña" },
                    { en: "garden view", es: "vista al jardín" },
                    { en: "street view", es: "vista a la calle" }
                ]
            }
        }
        ,
        search_fields: ['property_type', 'bedrooms', 'bathrooms', 'furnished', 'condition', 'amenities']
    },
    {
        category_key: 'electronics',
        display_name: 'Electronics & Gadgets',
        description: 'Phones, laptops, tablets, and electronic devices',
        icon: '📱',
        color: '#8B5CF6',
        sort_order: 3,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Category", es: "Categoría" },
                options: [
                    { en: "smartphones", es: "teléfonos inteligentes" },
                    { en: "laptops", es: "portátiles" },
                    { en: "tablets", es: "tabletas" },
                    { en: "watches", es: "relojes" },
                    { en: "washing machines", es: "lavadoras" },
                    { en: "fans", es: "ventiladores" },
                    { en: "televisions", es: "televisores" },
                    { en: "speakers", es: "altavoces" },
                    { en: "refrigerators", es: "refrigeradores" },
                    { en: "air conditioners", es: "aires acondicionados" },
                    { en: "microwaves", es: "microondas" },
                    { en: "audio systems", es: "sistemas de audio" },
                    { en: "video game consoles", es: "consolas de videojuegos" },
                    { en: "routers", es: "routers" },
                    { en: "security cameras", es: "cámaras de seguridad" },
                    { en: "bluetooth headphones", es: "auriculares bluetooth" },
                    { en: "smart home devices", es: "dispositivos de hogar inteligente" },
                    { en: "inverters", es: "inversores" },
                    { en: "power banks", es: "baterías portátiles" },
                    { en: "projectors", es: "proyectores" },
                    { en: "car audio", es: "audio para coche" },
                    { en: "drones", es: "drones" },
                    { en: "GPS devices", es: "dispositivos GPS" },
                    { en: "surge protectors", es: "protectores contra sobretensiones" },
                    { en: "other", es: "otros" }
                ]
            },
            brand: {
                type: "string",
                required: true,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Apple, Samsung, Dell...", es: "Apple, Samsung, Dell..." }
            },
            model: {
                type: "string",
                required: true,
                label: { en: "Model", es: "Modelo" },
                placeholder: { en: "iPhone 14, Galaxy S23...", es: "iPhone 14, Galaxy S23..." }
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "like new", es: "como nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "aceptable" },
                    { en: "poor", es: "deficiente" }
                ]
            },
            warranty: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Warranty", es: "Garantía" },
                options: [
                    { en: "no warranty", es: "sin garantía" },
                    { en: "seller warranty", es: "garantía del vendedor" },
                    { en: "manufacturer warranty", es: "garantía del fabricante" },
                    { en: "extended warranty", es: "garantía extendida" }
                ]
            },
            storage: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Storage", es: "Almacenamiento" },
                placeholder: { en: "128GB, 256GB, 1TB...", es: "128GB, 256GB, 1TB..." }
            },
            ram: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "RAM", es: "RAM" },
                placeholder: { en: "4GB, 8GB, 16GB...", es: "4GB, 8GB, 16GB..." }
            },
            processor: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Processor", es: "Procesador" },
                placeholder: { en: "Intel i7, AMD Ryzen...", es: "Intel i7, AMD Ryzen..." }
            },
            screen_size: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Screen Size", es: "Tamaño de pantalla" },
                placeholder: { en: "6.1\", 13\", 15.6\"...", es: "6.1\", 13\", 15.6\"..." }
            },
            color: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Color", es: "Color" }
            },
            connectivity: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Connectivity", es: "Conectividad" },
                options: [
                    { en: "wifi", es: "wifi" },
                    { en: "bluetooth", es: "bluetooth" },
                    { en: "4g", es: "4G" },
                    { en: "5g", es: "5G" },
                    { en: "nfc", es: "NFC" },
                    { en: "gps", es: "GPS" },
                    { en: "usb-c", es: "USB-C" },
                    { en: "hdmi", es: "HDMI" },
                    { en: "ethernet", es: "Ethernet" }
                ]
            },
            accessories: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Included Accessories", es: "Accesorios incluidos" },
                options: [
                    { en: "charger", es: "cargador" },
                    { en: "cable", es: "cable" },
                    { en: "case", es: "funda" },
                    { en: "screen protector", es: "protector de pantalla" },
                    { en: "headphones", es: "auriculares" },
                    { en: "stylus", es: "lápiz táctil" },
                    { en: "keyboard", es: "teclado" },
                    { en: "mouse", es: "ratón" }
                ]
            },
            original_box: {
                type: "boolean",
                hidden: true,
                required: false,
                label: { en: "Original Box Included", es: "Caja original incluida" }
            },
            receipt: {
                type: "boolean",
                hidden: true,
                required: false,
                label: { en: "Receipt Available", es: "Recibo disponible" }
            }
        },
        search_fields: ['brand', 'model', 'condition', 'storage', 'ram', 'processor']
    },
    {
        category_key: 'fashion',
        display_name: 'Fashion & Clothing',
        description: 'Clothes, shoes, bags, and accessories',
        icon: '👕',
        color: '#F59E0B',
        sort_order: 4,
        basic_attributes: {},
        attributes: {
            brand: {
                type: "string",
                required: false,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Nike, Adidas, Zara...", es: "Nike, Adidas, Zara..." }
            },
            category: {
                type: "enum",
                required: true,
                label: { en: "Fashion Category", es: "Categoría de moda" },
                options: [
                    { en: "shirts", es: "camisas" },
                    { en: "pants", es: "pantalones" },
                    { en: "dresses", es: "vestidos" },
                    { en: "shoes", es: "zapatos" },
                    { en: "bags", es: "bolsos" },
                    { en: "accessories", es: "accesorios" },
                    { en: "jewelry", es: "joyería" },
                    { en: "watches", es: "relojes" },
                    { en: "sunglasses", es: "gafas de sol" },
                    { en: "hats", es: "sombreros" },
                    { en: "scarves", es: "bufandas" }
                ]
            },
            size: {
                type: "string",
                required: false,
                label: { en: "Size", es: "Talla" },
                placeholder: { en: "S, M, L, XL, 42, 43...", es: "S, M, L, XL, 42, 43..." }
            },
            color: { type: "string", hidden: true, required: false, label: { en: "Color", es: "Color" } },
            material: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Material", es: "Material" },
                placeholder: { en: "Cotton, Leather, Polyester...", es: "Algodón, Cuero, Poliéster..." }
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new with tags", es: "nuevo con etiquetas" },
                    { en: "new without tags", es: "nuevo sin etiquetas" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "aceptable" },
                    { en: "poor", es: "malo" }
                ]
            },
            gender: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Gender", es: "Género" },
                options: [
                    { en: "men", es: "hombres" },
                    { en: "women", es: "mujeres" },
                    { en: "unisex", es: "unisex" },
                    { en: "kids", es: "niños" }
                ]
            },
            season: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Season", es: "Temporada" },
                options: [
                    { en: "spring", es: "primavera" },
                    { en: "summer", es: "verano" },
                    { en: "fall", es: "otoño" },
                    { en: "winter", es: "invierno" },
                    { en: "all season", es: "todas las temporadas" }
                ]
            },
            style: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Style", es: "Estilo" },
                options: [
                    { en: "casual", es: "casual" },
                    { en: "formal", es: "formal" },
                    { en: "sporty", es: "deportivo" },
                    { en: "vintage", es: "vintage" },
                    { en: "bohemian", es: "bohemio" },
                    { en: "minimalist", es: "minimalista" },
                    { en: "streetwear", es: "urbano" },
                    { en: "elegant", es: "elegante" }
                ]
            },
            original_price: {
                type: "number",
                hidden: true,
                required: false,
                label: { en: "Original Price", es: "Precio original" },
                min: 0
            },
            authenticity: {
                type: "enum",
                required: false,
                label: { en: "Authenticity", es: "Autenticidad" },
                options: [
                    { en: "authentic", es: "auténtico" },
                    { en: "replica", es: "réplica" },
                    { en: "inspired", es: "inspirado" },
                    { en: "unknown", es: "desconocido" }
                ]
            }
        },
        search_fields: ['brand', 'category', 'size', 'condition', 'gender', 'style']
    },
    {
        category_key: 'foods',
        display_name: 'Foods & Beverage',
        description: 'Foods, Groceries, snacks, beverages, and gourmet items',
        icon: '🍔',
        color: '#6B7280',
        sort_order: 5,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Food Category", es: "Categoría de alimentos" },
                options: [
                    { en: "snacks", es: "aperitivos" },
                    { en: "beverages", es: "bebidas" },
                    { en: "fresh produce", es: "productos frescos" },
                    { en: "meat and poultry", es: "carne y aves" },
                    { en: "dairy products", es: "productos lácteos" },
                    { en: "bakery items", es: "productos de panadería" },
                    { en: "canned goods", es: "alimentos enlatados" },
                    { en: "frozen foods", es: "alimentos congelados" },
                    { en: "grains and pasta", es: "cereales y pastas" },
                    { en: "condiments and sauces", es: "condimentos y salsas" },
                    { en: "organic and health", es: "orgánicos y saludables" },
                    { en: "gourmet", es: "gourmet" },
                    { en: "other", es: "otros" }
                ]
            },
            brand: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Nestlé, Pepsi, Kellogg’s...", es: "Nestlé, Pepsi, Kellogg’s..." }
            },
            package_size: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Package Size", es: "Tamaño del paquete" },
                placeholder: { en: "500g, 1L, 6-pack...", es: "500g, 1L, paquete de 6..." }
            },
            expiration_date: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Expiration Date", es: "Fecha de caducidad" },
                placeholder: { en: "YYYY-MM-DD", es: "AAAA-MM-DD" }
            },
            dietary_info: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Dietary Info", es: "Información dietética" },
                options: [
                    { en: "vegan", es: "vegano" },
                    { en: "vegetarian", es: "vegetariano" },
                    { en: "gluten free", es: "sin gluten" },
                    { en: "halal", es: "halal" },
                    { en: "kosher", es: "kosher" },
                    { en: "organic", es: "orgánico" },
                    { en: "non gmo", es: "no transgénico" },
                    { en: "low sugar", es: "bajo en azúcar" }
                ]
            },
            ingredients: { type: "string", hidden: true, required: false, label: { en: "Ingredients", es: "Ingredientes" } },
            nutrition_facts: { type: "string", hidden: true, required: false, label: { en: "Nutrition Facts", es: "Información nutricional" } },
            flavor: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Flavor", es: "Sabor" },
                placeholder: { en: "Vanilla, Spicy, BBQ...", es: "Vainilla, Picante, BBQ..." }
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "fresh", es: "fresco" },
                    { en: "frozen", es: "congelado" },
                    { en: "refrigerated", es: "refrigerado" }
                ]
            },
            storage_instructions: { type: "string", hidden: true, required: false, label: { en: "Storage Instructions", es: "Instrucciones de almacenamiento" } },
            delivery_available: { type: "boolean", hidden: true, required: false, label: { en: "Delivery Available", es: "Entrega disponible" } }
        },
        search_fields: ['category', 'brand', 'dietary_info', 'flavor', 'condition', 'delivery_available']
    },
    {
        category_key: 'services',
        display_name: 'Services',
        description: 'Professional services, repairs, and consultations',
        icon: '🔧',
        color: '#F97316',
        sort_order: 6,
        basic_attributes: {},
        attributes: {
            service_type: {
                type: "array",
                required: true,
                label: { en: "Service Type", es: "Tipo de servicio" },
                options: [
                    { en: "repair", es: "reparación" },
                    { en: "maintenance", es: "mantenimiento" },
                    { en: "cleaning", es: "limpieza" },
                    { en: "consultation", es: "consulta" },
                    { en: "tutoring", es: "tutoría" },
                    { en: "design", es: "diseño" },
                    { en: "photography", es: "fotografía" },
                    { en: "catering", es: "catering" },
                    { en: "transport", es: "transporte" },
                    { en: "beauty", es: "belleza" },
                    { en: "health", es: "salud" },
                    { en: "legal", es: "legal" },
                    { en: "accounting", es: "contabilidad" },
                    { en: "it", es: "informática" },
                    { en: "other", es: "otro" }
                ]
            },
            experience_years: {
                type: "number",
                required: false,
                label: { en: "Years of Experience", es: "Años de experiencia" },
                min: 0,
                max: 50
            },
            certification: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Certifications", es: "Certificaciones" }
            },
            availability: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Availability", es: "Disponibilidad" },
                options: [
                    { en: "immediate", es: "inmediata" },
                    { en: "within week", es: "dentro de una semana" },
                    { en: "within month", es: "dentro de un mes" },
                    { en: "by appointment", es: "con cita previa" }
                ]
            },
            service_area: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Service Area", es: "Área de servicio" },
                placeholder: { en: "City, Region, or Remote", es: "Ciudad, región o remoto" }
            },
            languages: {
                type: "array",
                required: false,
                label: { en: "Languages Spoken", es: "Idiomas hablados" },
                options: [
                    { en: "english", es: "inglés" },
                    { en: "spanish", es: "español" },
                    { en: "arabic", es: "árabe" },
                    { en: "french", es: "francés" },
                    { en: "german", es: "alemán" },
                    { en: "chinese", es: "chino" },
                    { en: "other", es: "otro" }
                ]
            },
            payment_methods: {
                type: "array",
                required: false,
                label: { en: "Payment Methods", es: "Métodos de pago" },
                options: [
                    { en: "cash", es: "efectivo" },
                    { en: "card", es: "tarjeta" },
                    { en: "bank transfer", es: "transferencia bancaria" },
                    { en: "paypal", es: "PayPal" },
                    { en: "crypto", es: "cripto" }
                ]
            },
            insurance: {
                type: "boolean",
                hidden: true,
                required: false,
                label: { en: "Insured", es: "Asegurado" }
            },
            warranty: {
                type: "boolean",
                required: false,
                label: { en: "Service Warranty", es: "Garantía del servicio" }
            },
            emergency_service: {
                type: "boolean",
                required: false,
                label: { en: "Emergency Service Available", es: "Servicio de emergencia disponible" }
            }
        },
        search_fields: ['service_type', 'experience_years', 'availability', 'service_area']
    },
    {
        category_key: 'vehicle_parts',
        display_name: 'Vehicle Parts & Accessories',
        description: 'Sell car parts and accessories — batteries, rims, speakers, lights, GPS, and more',
        icon: '🔧',
        color: '#400f79',
        sort_order: 7,
        basic_attributes: {},
        attributes: {
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "Used(Good)", es: "Usado (Bueno)" },
                    { en: "Used(For Parts)", es: "Usado (Para repuestos)" }
                ]
            },
            part_type: {
                type: "enum",
                required: true,
                label: { en: "Parts/Accessories Type", es: "Tipo de partes/accesorios" },
                options: [
                    { en: "Engine & Transmission", es: "Motor y transmisión" },
                    { en: "Tires & Rims", es: "Neumáticos y llantas" },
                    { en: "Lights & Mirrors", es: "Luces y espejos" },
                    { en: "Batteries", es: "Baterías" },
                    { en: "Suspension & Brakes", es: "Suspensión y frenos" },
                    { en: "Interior (Seats, Mats, etc.)", es: "Interior (asientos, alfombrillas, etc.)" },
                    { en: "Audio & Multimedia", es: "Audio y multimedia" },
                    { en: "Security (GPS, Alarms)", es: "Seguridad (GPS, alarmas)" },
                    { en: "Other", es: "Otro" }
                ]
            },
            compatible_with: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Compatible With", es: "Compatible con" }
            }
        },
        search_fields: ['condition', 'part_type']
    },
    {
        category_key: 'jobs',
        display_name: 'Jobs & Employment',
        description: 'Job opportunities, freelance work, and career positions',
        icon: '💼',
        color: '#6366F1',
        sort_order: 8,
        basic_attributes: {},
        attributes: {
            job_type: {
                type: "enum",
                required: true,
                label: { en: "Job Type", es: "Tipo de trabajo" },
                options: [
                    { en: "full time", es: "tiempo completo" },
                    { en: "part time", es: "medio tiempo" },
                    { en: "contract", es: "contrato" },
                    { en: "freelance", es: "freelance" },
                    { en: "internship", es: "pasantía" },
                    { en: "temporary", es: "temporal" },
                    { en: "remote", es: "remoto" },
                    { en: "hybrid", es: "híbrido" }
                ]
            },
            industry: {
                type: "enum",
                required: true,
                label: { en: "Industry", es: "Industria" },
                options: [
                    { en: "technology", es: "tecnología" },
                    { en: "healthcare", es: "salud" },
                    { en: "education", es: "educación" },
                    { en: "finance", es: "finanzas" },
                    { en: "retail", es: "comercio minorista" },
                    { en: "manufacturing", es: "manufactura" },
                    { en: "marketing", es: "marketing" },
                    { en: "sales", es: "ventas" },
                    { en: "customer service", es: "atención al cliente" },
                    { en: "design", es: "diseño" },
                    { en: "writing", es: "redacción" },
                    { en: "consulting", es: "consultoría" },
                    { en: "hospitality", es: "hostelería" },
                    { en: "construction", es: "construcción" },
                    { en: "transportation", es: "transporte" },
                    { en: "other", es: "otro" }
                ]
            },
            experience_level: {
                type: "enum",
                required: true,
                label: { en: "Experience Level", es: "Nivel de experiencia" },
                options: [
                    { en: "entry level", es: "nivel inicial" },
                    { en: "junior", es: "junior" },
                    { en: "mid level", es: "nivel medio" },
                    { en: "senior", es: "senior" },
                    { en: "executive", es: "ejecutivo" },
                    { en: "internship", es: "pasantía" }
                ]
            },
            salary_min: {
                type: "number",
                required: false,
                label: { en: "Minimum Salary", es: "Salario mínimo" },
                min: 0
            },
            salary_max: {
                type: "number",
                required: false,
                label: { en: "Maximum Salary", es: "Salario máximo" },
                min: 0
            },
            salary_type: {
                type: "enum",
                required: false,
                label: { en: "Salary Type", es: "Tipo de salario" },
                options: [
                    { en: "hourly", es: "por hora" },
                    { en: "monthly", es: "mensual" },
                    { en: "yearly", es: "anual" },
                    { en: "project based", es: "por proyecto" },
                    { en: "commission", es: "comisión" }
                ]
            },
            location_type: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Location Type", es: "Tipo de ubicación" },
                options: [
                    { en: "onsite", es: "presencial" },
                    { en: "remote", es: "remoto" },
                    { en: "hybrid", es: "híbrido" },
                    { en: "travel", es: "viajes" }
                ]
            },
            skills_required: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Required Skills", es: "Habilidades requeridas" },
                options: [
                    { en: "javascript", es: "javascript" },
                    { en: "python", es: "python" },
                    { en: "java", es: "java" },
                    { en: "react", es: "react" },
                    { en: "nodejs", es: "nodejs" },
                    { en: "sql", es: "sql" },
                    { en: "aws", es: "aws" },
                    { en: "docker", es: "docker" },
                    { en: "kubernetes", es: "kubernetes" },
                    { en: "agile", es: "ágil" },
                    { en: "scrum", es: "scrum" },
                    { en: "project management", es: "gestión de proyectos" },
                    { en: "sales", es: "ventas" },
                    { en: "marketing", es: "marketing" },
                    { en: "design", es: "diseño" },
                    { en: "writing", es: "redacción" },
                    { en: "customer service", es: "atención al cliente" }
                ]
            },
            education_level: {
                type: "enum",
                required: false,
                label: { en: "Education Level", es: "Nivel educativo" },
                options: [
                    { en: "high school", es: "secundaria" },
                    { en: "associate", es: "técnico" },
                    { en: "bachelor", es: "licenciatura" },
                    { en: "master", es: "maestría" },
                    { en: "phd", es: "doctorado" },
                    { en: "certification", es: "certificación" },
                    { en: "none required", es: "no requerido" }
                ]
            },
            benefits: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Benefits", es: "Beneficios" },
                options: [
                    { en: "health insurance", es: "seguro médico" },
                    { en: "dental insurance", es: "seguro dental" },
                    { en: "vision insurance", es: "seguro de visión" },
                    { en: "retirement plan", es: "plan de jubilación" },
                    { en: "paid time off", es: "vacaciones pagadas" },
                    { en: "flexible hours", es: "horario flexible" },
                    { en: "remote work", es: "trabajo remoto" },
                    { en: "professional development", es: "desarrollo profesional" },
                    { en: "gym membership", es: "membresía de gimnasio" },
                    { en: "meal allowance", es: "vales de comida" }
                ]
            },
            start_date: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Start Date", es: "Fecha de inicio" },
                placeholder: { en: "Immediate, Next Month...", es: "Inmediato, Próximo mes..." }
            },
            contract_duration: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Contract Duration", es: "Duración del contrato" },
                placeholder: { en: "3 months, 1 year...", es: "3 meses, 1 año..." }
            }
        },
        search_fields: ['job_type', 'industry', 'experience_level', 'location_type', 'skills_required']
    },
    {
        category_key: 'furniture',
        display_name: 'Furniture & Home',
        description: 'Furniture, appliances, and home decor',
        icon: '🪑',
        color: '#EF4444',
        sort_order: 9,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Furniture Category", es: "Categoría de muebles" },
                options: [
                    { en: "sofa", es: "sofá" },
                    { en: "bed", es: "cama" },
                    { en: "table", es: "mesa" },
                    { en: "chair", es: "silla" },
                    { en: "cabinet", es: "armario" },
                    { en: "shelf", es: "estante" },
                    { en: "desk", es: "escritorio" },
                    { en: "mattress", es: "colchón" },
                    { en: "appliance", es: "electrodoméstico" },
                    { en: "decor", es: "decoración" },
                    { en: "lighting", es: "iluminación" },
                    { en: "rug", es: "alfombra" }
                ]
            },
            material: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Material", es: "Material" },
                placeholder: { en: "Wood, Leather, Fabric, Metal...", es: "Madera, Cuero, Tela, Metal..." }
            },
            color: { type: "string", hidden: true, required: false, label: { en: "Color", es: "Color" } },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "regular" },
                    { en: "needs repair", es: "necesita reparación" }
                ]
            },
            dimensions: {
                type: "string",
                
                required: false,
                label: { en: "Dimensions", es: "Dimensiones" },
                placeholder: { en: "120x60x75 cm", es: "120x60x75 cm" }
            },
            room: {
                type: "enum",
                required: false,
                label: { en: "Room", es: "Habitación" },
                options: [
                    { en: "living room", es: "sala de estar" },
                    { en: "bedroom", es: "dormitorio" },
                    { en: "kitchen", es: "cocina" },
                    { en: "dining room", es: "comedor" },
                    { en: "office", es: "oficina" },
                    { en: "bathroom", es: "baño" },
                    { en: "outdoor", es: "exterior" },
                    { en: "garage", es: "garaje" }
                ]
            },
            style: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Style", es: "Estilo" },
                options: [
                    { en: "modern", es: "moderno" },
                    { en: "traditional", es: "tradicional" },
                    { en: "vintage", es: "vintage" },
                    { en: "industrial", es: "industrial" },
                    { en: "scandinavian", es: "escandinavo" },
                    { en: "minimalist", es: "minimalista" },
                    { en: "bohemian", es: "bohemio" },
                    { en: "luxury", es: "lujoso" }
                ]
            },
            assembly_required: { type: "boolean", required: false, label: { en: "Assembly Required", es: "Requiere ensamblaje" } },
            warranty: {
                type: "enum",
                required: false,
                label: { en: "Warranty", es: "Garantía" },
                options: [
                    { en: "no warranty", es: "sin garantía" },
                    { en: "seller warranty", es: "garantía del vendedor" },
                    { en: "manufacturer warranty", es: "garantía del fabricante" }
                ]
            },
            power_consumption: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Power Consumption", es: "Consumo de energía" },
                placeholder: { en: "1000W, Energy Star...", es: "1000W, Energy Star..." }
            },
            features: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Features", es: "Características" },
                options: [
                    { en: "adjustable", es: "ajustable" },
                    { en: "foldable", es: "plegable" },
                    { en: "extendable", es: "extensible" },
                    { en: "storage", es: "almacenamiento" },
                    { en: "wheels", es: "ruedas" },
                    { en: "remote control", es: "control remoto" },
                    { en: "smart features", es: "funciones inteligentes" }
                ]
            }
        },
        search_fields: ['category', 'material', 'condition', 'room', 'style']
    },
    {
        category_key: 'books',
        display_name: 'Books & Media',
        description: 'Books, magazines, movies, and educational materials',
        icon: '📚',
        color: '#06B6D4',
        sort_order: 10,
        basic_attributes: {},
        attributes: {
            title: { type: "string", required: true, label: { en: "Title", es: "Título" } },
            author: { type: "string", required: false, label: { en: "Author", es: "Autor" } },
            publisher: { type: "string", required: false, label: { en: "Publisher", es: "Editorial" } },
            isbn: { type: "string", required: false, label: { en: "ISBN", es: "ISBN" } },
            language: {
                type: "string",
                required: false,
                label: { en: "Language", es: "Idioma" },
                placeholder: { en: "English, Spanish, Arabic...", es: "Inglés, Español, Árabe..." }
            },
            format: {
                type: "enum",
                required: true,
                label: { en: "Format", es: "Formato" },
                options: [
                    { en: "hardcover", es: "tapa dura" },
                    { en: "paperback", es: "tapa blanda" },
                    { en: "ebook", es: "libro electrónico" },
                    { en: "audiobook", es: "audiolibro" },
                    { en: "magazine", es: "revista" },
                    { en: "dvd", es: "DVD" },
                    { en: "bluray", es: "Blu-ray" },
                    { en: "cd", es: "CD" },
                    { en: "vinyl", es: "vinilo" }
                ]
            },
            genre: {
                type: "enum",
                required: false,
                label: { en: "Genre", es: "Género" },
                options: [
                    { en: "fiction", es: "ficción" },
                    { en: "non-fiction", es: "no ficción" },
                    { en: "mystery", es: "misterio" },
                    { en: "romance", es: "romance" },
                    { en: "sci-fi", es: "ciencia ficción" },
                    { en: "fantasy", es: "fantasía" },
                    { en: "biography", es: "biografía" },
                    { en: "history", es: "historia" },
                    { en: "science", es: "ciencia" },
                    { en: "self-help", es: "autoayuda" },
                    { en: "cookbook", es: "libro de cocina" },
                    { en: "travel", es: "viajes" },
                    { en: "children", es: "infantil" },
                    { en: "academic", es: "académico" },
                    { en: "textbook", es: "libro de texto" }
                ]
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "like new", es: "como nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "aceptable" },
                    { en: "poor", es: "deficiente" }
                ]
            },
            pages: { type: "number", hidden: true, required: false, label: { en: "Number of Pages", es: "Número de páginas" }, min: 1 },
            publication_year: { type: "number", hidden: true, required: false, label: { en: "Publication Year", es: "Año de publicación" }, min: 1800, max: 2030 },
            edition: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Edition", es: "Edición" },
                placeholder: { en: "1st, 2nd, Special...", es: "1ª, 2ª, Especial..." }
            },
            signed: { type: "boolean", hidden: true, required: false, label: { en: "Signed by Author", es: "Firmado por el autor" } },
            original_price: { type: "number", hidden: true, required: false, label: { en: "Original Price", es: "Precio original" }, min: 0 }
        },
        search_fields: ['title', 'author', 'genre', 'format', 'condition']
    },
    {
        category_key: 'sports',
        display_name: 'Sports & Fitness',
        description: 'Sports equipment, fitness gear, and outdoor activities',
        icon: '⚽',
        color: '#84CC16',
        sort_order: 11,
        basic_attributes: {},
        attributes: {
            sport: {
                type: "enum",
                required: true,
                label: { en: "Sport", es: "Deporte" },
                options: [
                    { en: "football", es: "fútbol" },
                    { en: "basketball", es: "baloncesto" },
                    { en: "tennis", es: "tenis" },
                    { en: "golf", es: "golf" },
                    { en: "swimming", es: "natación" },
                    { en: "cycling", es: "ciclismo" },
                    { en: "running", es: "correr" },
                    { en: "gym", es: "gimnasio" },
                    { en: "yoga", es: "yoga" },
                    { en: "hiking", es: "senderismo" },
                    { en: "fishing", es: "pesca" },
                    { en: "camping", es: "camping" },
                    { en: "skiing", es: "esquí" },
                    { en: "snowboarding", es: "snowboard" },
                    { en: "surfing", es: "surf" },
                    { en: "other", es: "otro" }
                ]
            },
            brand: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Nike, Adidas, Under Armour...", es: "Nike, Adidas, Under Armour..." }
            },
            model: { type: "string", hidden: true, required: false, label: { en: "Model", es: "Modelo" } },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "aceptable" },
                    { en: "needs repair", es: "necesita reparación" }
                ]
            },
            size: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Size", es: "Talla" },
                placeholder: { en: "S, M, L, XL, 42, 43...", es: "S, M, L, XL, 42, 43..." }
            },
            material: { type: "string", hidden: true, required: false, label: { en: "Material", es: "Material" } },
            color: { type: "string", hidden: true, required: false, label: { en: "Color", es: "Color" } },
            weight: {
                type: "string",
                required: false,
                label: { en: "Weight", es: "Peso" },
                placeholder: { en: "250g, 1.5kg...", es: "250g, 1.5kg..." }
            },
            features: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Features", es: "Características" },
                options: [
                    { en: "adjustable", es: "ajustable" },
                    { en: "foldable", es: "plegable" },
                    { en: "portable", es: "portátil" },
                    { en: "waterproof", es: "impermeable" },
                    { en: "shock absorbing", es: "amortiguador de golpes" },
                    { en: "anti slip", es: "antideslizante" },
                    { en: "ventilated", es: "ventilado" },
                    { en: "padded", es: "acolchado" }
                ]
            },
            warranty: {
                type: "enum",
                required: false,
                label: { en: "Warranty", es: "Garantía" },
                options: [
                    { en: "no warranty", es: "sin garantía" },
                    { en: "seller warranty", es: "garantía del vendedor" },
                    { en: "manufacturer_warranty", es: "garantía del fabricante" }
                ]
            },
            usage_level: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Usage Level", es: "Nivel de uso" },
                options: [
                    { en: "beginner", es: "principiante" },
                    { en: "intermediate", es: "intermedio" },
                    { en: "advanced", es: "avanzado" },
                    { en: "professional", es: "profesional" }
                ]
            }
        },
        search_fields: ['sport', 'brand', 'condition', 'size', 'usage_level']
    },
    {
        category_key: 'pets',
        display_name: 'Pets & Animals',
        description: 'Dogs, cats, birds, and other pets for sale or adoption',
        icon: '🐕',
        color: '#EC4899',
        sort_order: 12,
        basic_attributes: {},
        attributes: {
            animal_type: {
                type: "enum",
                required: true,
                label: { en: "Animal Type", es: "Tipo de animal" },
                options: [
                    { en: "dog", es: "perro" },
                    { en: "cat", es: "gato" },
                    { en: "bird", es: "pájaro" },
                    { en: "fish", es: "pez" },
                    { en: "rabbit", es: "conejo" },
                    { en: "hamster", es: "hámster" },
                    { en: "guinea pig", es: "cobaya" },
                    { en: "reptile", es: "reptil" },
                    { en: "horse", es: "caballo" },
                    { en: "farm animal", es: "animal de granja" },
                    { en: "exotic", es: "exótico" },
                    { en: "other", es: "otro" }
                ]
            },
            breed: {
                type: "string",
                required: false,
                label: { en: "Breed", es: "Raza" },
                placeholder: { en: "Golden Retriever, Persian, Budgie...", es: "Golden Retriever, Persa, Periquito..." }
            },
            age: { type: "number", required: false, label: { en: "Age (months)", es: "Edad (meses)" }, min: 0, max: 240 },
            gender: {
                type: "enum",
                required: false,
                label: { en: "Gender", es: "Género" },
                options: [
                    { en: "male", es: "macho" },
                    { en: "female", es: "hembra" },
                    { en: "unknown", es: "desconocido" }
                ]
            },
            color: { type: "string", required: false, label: { en: "Color/Markings", es: "Color/Marcas" } },
            size: {
                type: "enum",
                required: false,
                label: { en: "Size", es: "Tamaño" },
                options: [
                    { en: "tiny", es: "diminuto" },
                    { en: "small", es: "pequeño" },
                    { en: "medium", es: "mediano" },
                    { en: "large", es: "grande" },
                    { en: "giant", es: "gigante" }
                ]
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "healthy", es: "saludable" },
                    { en: "needs attention", es: "requiere atención" },
                    { en: "special needs", es: "necesidades especiales" },
                    { en: "senior", es: "anciano" }
                ]
            },
            vaccinated: { type: "boolean", required: false, label: { en: "Vaccinated", es: "Vacunado" } },
            neutered: { type: "boolean", required: false, label: { en: "Neutered/Spayed", es: "Castrado/Esterilizado" } },
            microchipped: { type: "boolean", required: false, label: { en: "Microchipped", es: "Con microchip" } },
            trained: { type: "boolean", required: false, label: { en: "Trained", es: "Adiestrado" } },
            good_with: {
                type: "array",
                required: false,
                label: { en: "Good With", es: "Bueno con" },
                options: [
                    { en: "children", es: "niños" },
                    { en: "other dogs", es: "otros perros" },
                    { en: "other cats", es: "otros gatos" },
                    { en: "strangers", es: "desconocidos" },
                    { en: "elderly", es: "ancianos" }
                ]
            },
            special_needs: { type: "string", required: false, label: { en: "Special Needs/Requirements", es: "Necesidades/Requerimientos especiales" } },
            reason_for_sale: {
                type: "enum",
                required: false,
                label: { en: "Reason for Sale", es: "Razón de venta" },
                options: [
                    { en: "moving", es: "mudanza" },
                    { en: "allergies", es: "alergias" },
                    { en: "no time", es: "falta de tiempo" },
                    { en: "financial", es: "financiera" },
                    { en: "adoption", es: "adopción" },
                    { en: "litter", es: "camada" },
                    { en: "other", es: "otro" }
                ]
            }
        },
        search_fields: ['animal_type', 'breed', 'age', 'gender', 'condition', 'size']
    },
    {
        category_key: 'collectibles',
        display_name: 'Collectibles & Antiques',
        description: 'Stamps, coins, art, vintage items, and rare collectibles',
        icon: '🏺',
        color: '#A855F7',
        sort_order: 13,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Collectible Category", es: "Categoría de coleccionable" },
                options: [
                    { en: "stamps", es: "sellos" },
                    { en: "coins", es: "monedas" },
                    { en: "art", es: "arte" },
                    { en: "comics", es: "cómics" },
                    { en: "cards", es: "cartas" },
                    { en: "figures", es: "figuras" },
                    { en: "dolls", es: "muñecas" },
                    { en: "toys", es: "juguetes" },
                    { en: "books", es: "libros" },
                    { en: "records", es: "discos" },
                    { en: "watches", es: "relojes" },
                    { en: "jewelry", es: "joyas" },
                    { en: "furniture", es: "muebles" },
                    { en: "clothing", es: "ropa" },
                    { en: "militaria", es: "militaria" },
                    { en: "sports memorabilia", es: "recuerdos deportivos" },
                    { en: "other", es: "otro" }
                ]
            },
            era: {
                type: "enum",
                required: false,
                label: { en: "Era/Period", es: "Época/Periodo" },
                options: [
                    { en: "ancient", es: "antiguo" },
                    { en: "medieval", es: "medieval" },
                    { en: "renaissance", es: "renacimiento" },
                    { en: "18th century", es: "siglo XVIII" },
                    { en: "19th century", es: "siglo XIX" },
                    { en: "early 20th", es: "principios del siglo XX" },
                    { en: "mid 20th", es: "mediados del siglo XX" },
                    { en: "late 20th", es: "finales del siglo XX" },
                    { en: "modern", es: "moderno" },
                    { en: "contemporary", es: "contemporáneo" }
                ]
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "mint", es: "impecable" },
                    { en: "near mint", es: "casi impecable" },
                    { en: "excellent", es: "excelente" },
                    { en: "very good", es: "muy bueno" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "aceptable" },
                    { en: "poor", es: "malo" }
                ]
            },
            rarity: {
                type: "enum",
                required: false,
                label: { en: "Rarity", es: "Rareza" },
                options: [
                    { en: "common", es: "común" },
                    { en: "uncommon", es: "poco común" },
                    { en: "rare", es: "raro" },
                    { en: "very rare", es: "muy raro" },
                    { en: "ultra rare", es: "ultra raro" },
                    { en: "legendary", es: "legendario" }
                ]
            },
            authenticity: {
                type: "enum",
                required: false,
                label: { en: "Authenticity", es: "Autenticidad" },
                options: [
                    { en: "authentic", es: "auténtico" },
                    { en: "reproduction", es: "reproducción" },
                    { en: "replica", es: "réplica" },
                    { en: "unknown", es: "desconocido" },
                    { en: "certified", es: "certificado" }
                ]
            },
            certification: { type: "string", required: false, label: { en: "Certification/Authentication", es: "Certificación/Autenticación" } },
            provenance: { type: "string", required: false, label: { en: "Provenance/History", es: "Procedencia/Historia" } },
            materials: {
                type: "string",
                required: false,
                label: { en: "Materials", es: "Materiales" },
                placeholder: { en: "Gold, Silver, Bronze, Paper...", es: "Oro, Plata, Bronce, Papel..." }
            },
            dimensions: {
                type: "string",
                required: false,
                label: { en: "Dimensions", es: "Dimensiones" },
                placeholder: { en: "10x15 cm, 2 inches...", es: "10x15 cm, 2 pulgadas..." }
            },
            weight: {
                type: "string",
                required: false,
                label: { en: "Weight", es: "Peso" },
                placeholder: { en: "50g, 2oz...", es: "50g, 2oz..." }
            },
            original_price: { type: "number", required: false, label: { en: "Original Price", es: "Precio original" }, min: 0 },
            appraisal_value: { type: "number", required: false, label: { en: "Appraisal Value", es: "Valor de tasación" }, min: 0 },
            storage_condition: {
                type: "enum",
                required: false,
                label: { en: "Storage Condition", es: "Condición de almacenamiento" },
                options: [
                    { en: "display case", es: "vitrina" },
                    { en: "safe", es: "caja fuerte" },
                    { en: "climate controlled", es: "climatizado" },
                    { en: "regular storage", es: "almacenamiento normal" },
                    { en: "needs attention", es: "requiere atención" }
                ]
            }
        },
        search_fields: ['category', 'era', 'condition', 'rarity', 'authenticity']
    },
    {
        category_key: 'health',
        display_name: 'Health & Beauty',
        description: 'Medical equipment, beauty products, and wellness items',
        icon: '💊',
        color: '#14B8A6',
        sort_order: 14,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Health Category", es: "Categoría de salud" },
                options: [
                    { en: "medical equipment", es: "equipo médico" },
                    { en: "beauty products", es: "productos de belleza" },
                    { en: "skincare", es: "cuidado de la piel" },
                    { en: "haircare", es: "cuidado del cabello" },
                    { en: "makeup", es: "maquillaje" },
                    { en: "fragrances", es: "fragancias" },
                    { en: "vitamins", es: "vitaminas" },
                    { en: "supplements", es: "suplementos" },
                    { en: "fitness equipment", es: "equipo de fitness" },
                    { en: "wellness products", es: "productos de bienestar" },
                    { en: "dental care", es: "cuidado dental" },
                    { en: "first aid", es: "primeros auxilios" },
                    { en: "mobility aids", es: "ayudas de movilidad" },
                    { en: "other", es: "otro" }
                ]
            },
            brand: {
                type: "string",
                required: false,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "Johnson & Johnson, L'Oreal, Nike...", es: "Johnson & Johnson, L'Oreal, Nike..." }
            },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "unopened", es: "sin abrir" },
                    { en: "lightly used", es: "ligeramente usado" },
                    { en: "used", es: "usado" },
                    { en: "expired", es: "vencido" }
                ]
            },
            expiration_date: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Expiration Date", es: "Fecha de caducidad" },
                placeholder: { en: "2024-12-31", es: "2024-12-31" }
            },
            size: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Size", es: "Tamaño" },
                placeholder: { en: "100ml, 50 tablets, Large...", es: "100ml, 50 tabletas, Grande..." }
            },
            skin_type: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Skin Type", es: "Tipo de piel" },
                options: [
                    { en: "normal", es: "normal" },
                    { en: "dry", es: "seca" },
                    { en: "oily", es: "grasosa" },
                    { en: "combination", es: "mixta" },
                    { en: "sensitive", es: "sensible" },
                    { en: "acne prone", es: "propensa al acné" },
                    { en: "mature", es: "madura" }
                ]
            },
            skin_concerns: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Skin Concerns", es: "Preocupaciones de la piel" },
                options: [
                    { en: "acne", es: "acné" },
                    { en: "aging", es: "envejecimiento" },
                    { en: "dark-spots", es: "manchas oscuras" },
                    { en: "dryness", es: "sequedad" },
                    { en: "oiliness", es: "grasitud" },
                    { en: "redness", es: "enrojecimiento" },
                    { en: "scars", es: "cicatrices" },
                    { en: "wrinkles", es: "arrugas" },
                    { en: "none", es: "ninguno" }
                ]
            },
            ingredients: { type: "string", hidden: true, required: false, label: { en: "Key Ingredients", es: "Ingredientes clave" } },
            cruelty_free: { type: "boolean", hidden: true, required: false, label: { en: "Cruelty Free", es: "Libre de crueldad" } },
            vegan: { type: "boolean", hidden: true, required: false, label: { en: "Vegan", es: "Vegano" } },
            organic: { type: "boolean", hidden: true, required: false, label: { en: "Organic", es: "Orgánico" } },
            prescription_required: { type: "boolean", hidden: true, required: false, label: { en: "Prescription Required", es: "Requiere receta" } },
            usage_instructions: { type: "string", hidden: true, required: false, label: { en: "Usage Instructions", es: "Instrucciones de uso" } },
            warranty: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Warranty", es: "Garantía" },
                options: [
                    { en: "no warranty", es: "sin garantía" },
                    { en: "30 days", es: "30 días" },
                    { en: "90 days", es: "90 días" },
                    { en: "1 year", es: "1 año" },
                    { en: "lifetime", es: "de por vida" }
                ]
            }
        },
        search_fields: ['category', 'brand', 'condition', 'skin_type', 'skin_concerns']
    },
    {
        category_key: 'education',
        display_name: 'Education & Training',
        description: 'Courses, tutoring, workshops, and educational materials',
        icon: '🎓',
        color: '#F59E0B',
        sort_order: 15,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Education Category", es: "Categoría educativa" },
                options: [
                    { en: "online course", es: "curso en línea" },
                    { en: "in person course", es: "curso presencial" },
                    { en: "tutoring", es: "tutoría" },
                    { en: "workshop", es: "taller" },
                    { en: "seminar", es: "seminario" },
                    { en: "certification", es: "certificación" },
                    { en: "degree program", es: "programa de grado" },
                    { en: "language learning", es: "aprendizaje de idiomas" },
                    { en: "music lessons", es: "clases de música" },
                    { en: "art classes", es: "clases de arte" },
                    { en: "cooking classes", es: "clases de cocina" },
                    { en: "fitness training", es: "entrenamiento físico" },
                    { en: "business training", es: "formación empresarial" },
                    { en: "technical training", es: "formación técnica" },
                    { en: "other", es: "otro" }
                ]
            },
            subject: {
                type: "enum",
                required: true,
                label: { en: "Subject", es: "Asignatura" },
                options: [
                    { en: "mathematics", es: "matemáticas" },
                    { en: "science", es: "ciencias" },
                    { en: "language", es: "idioma" },
                    { en: "history", es: "historia" },
                    { en: "literature", es: "literatura" },
                    { en: "art", es: "arte" },
                    { en: "music", es: "música" },
                    { en: "cooking", es: "cocina" },
                    { en: "fitness", es: "fitness" },
                    { en: "business", es: "negocios" },
                    { en: "technology", es: "tecnología" },
                    { en: "health", es: "salud" },
                    { en: "finance", es: "finanzas" },
                    { en: "marketing", es: "mercadotecnia" },
                    { en: "design", es: "diseño" },
                    { en: "photography", es: "fotografía" },
                    { en: "writing", es: "escritura" },
                    { en: "other", es: "otro" }
                ]
            },
            level: {
                type: "enum",
                required: true,
                label: { en: "Level", es: "Nivel" },
                options: [
                    { en: "beginner", es: "principiante" },
                    { en: "intermediate", es: "intermedio" },
                    { en: "advanced", es: "avanzado" },
                    { en: "expert", es: "experto" },
                    { en: "all levels", es: "todos los niveles" }
                ]
            },
            format: {
                type: "enum",
                required: true,
                label: { en: "Format", es: "Formato" },
                options: [
                    { en: "one-on-one", es: "uno a uno" },
                    { en: "group", es: "grupo" },
                    { en: "self-paced", es: "a tu propio ritmo" },
                    { en: "live online", es: "en vivo en línea" },
                    { en: "recorded", es: "grabado" },
                    { en: "hybrid", es: "híbrido" }
                ]
            },
            duration: {
                type: "string",
                required: false,
                label: { en: "Duration", es: "Duración" },
                placeholder: { en: "2 hours, 8 weeks, 6 months...", es: "2 horas, 8 semanas, 6 meses..." }
            },
            schedule: {
                type: "string",
                required: false,
                label: { en: "Schedule", es: "Horario" },
                placeholder: { en: "Mondays 6-8 PM, Flexible...", es: "Lunes 6-8 PM, Flexible..." }
            },
            location: {
                type: "string",
                required: false,
                label: { en: "Location", es: "Ubicación" },
                placeholder: { en: "Online, Downtown, Home visits...", es: "En línea, Centro, Visitas a domicilio..." }
            },
            instructor_qualifications: {
                type: "string",
                required: false,
                label: { en: "Instructor Qualifications", es: "Cualificaciones del instructor" }
            },
            max_students: { type: "number", required: false, label: { en: "Maximum Students", es: "Máximo de estudiantes" }, min: 1 },
            materials_included: { type: "boolean", required: false, label: { en: "Materials Included", es: "Materiales incluidos" } },
            certificate: { type: "boolean", required: false, label: { en: "Certificate Provided", es: "Certificado otorgado" } },
            prerequisites: { type: "string", required: false, label: { en: "Prerequisites", es: "Prerrequisitos" } },
            languages: {
                type: "array",
                required: false,
                label: { en: "Languages Available", es: "Idiomas disponibles" },
                options: [
                    { en: "english", es: "inglés" },
                    { en: "spanish", es: "español" },
                    { en: "arabic", es: "árabe" },
                    { en: "french", es: "francés" },
                    { en: "german", es: "alemán" },
                    { en: "chinese", es: "chino" },
                    { en: "other", es: "otro" }
                ]
            },
            refund_policy: {
                type: "enum",
                required: false,
                label: { en: "Refund Policy", es: "Política de reembolso" },
                options: [
                    { en: "no refunds", es: "sin reembolsos" },
                    { en: "full refund", es: "reembolso completo" },
                    { en: "partial refund", es: "reembolso parcial" },
                    { en: "credit only", es: "solo crédito" }
                ]
            }
        },
        search_fields: ['category', 'subject', 'level', 'format', 'location']
    },
    {
        category_key: 'events',
        display_name: 'Events & Tickets',
        description: 'Concert tickets, sports events, workshops, and entertainment',
        icon: '🎫',
        color: '#EF4444',
        sort_order: 16,
        basic_attributes: {},
        attributes: {
            event_type: {
                type: "enum",
                required: true,
                label: { en: "Event Type", es: "Tipo de evento" },
                options: [
                    { en: "concert", es: "concierto" },
                    { en: "sports", es: "deportes" },
                    { en: "theater", es: "teatro" },
                    { en: "comedy", es: "comedia" },
                    { en: "workshop", es: "taller" },
                    { en: "conference", es: "conferencia" },
                    { en: "festival", es: "festival" },
                    { en: "exhibition", es: "exposición" },
                    { en: "party", es: "fiesta" },
                    { en: "wedding", es: "boda" },
                    { en: "birthday", es: "cumpleaños" },
                    { en: "corporate", es: "corporativo" },
                    { en: "charity", es: "caridad" },
                    { en: "other", es: "otro" }
                ]
            },
            event_date: {
                type: "string",
                required: true,
                label: { en: "Event Date", es: "Fecha del evento" },
                placeholder: { en: "2024-12-25", es: "25-12-2024" }
            },
            event_time: {
                type: "string",
                required: false,
                label: { en: "Event Time", es: "Hora del evento" },
                placeholder: { en: "7:00 PM", es: "19:00" }
            },
            venue: { type: "string", hidden: true, required: false, label: { en: "Venue/Location", es: "Lugar/Ubicación" } },
            city: { type: "string", required: false, label: { en: "City", es: "Ciudad" } },
            ticket_type: {
                type: "enum",
                required: true,
                label: { en: "Ticket Type", es: "Tipo de entrada" },
                options: [
                    { en: "general admission", es: "entrada general" },
                    { en: "vip", es: "VIP" },
                    { en: "premium", es: "premium" },
                    { en: "backstage", es: "tras bambalinas" },
                    { en: "meet greet", es: "meet & greet" },
                    { en: "early bird", es: "entrada anticipada" },
                    { en: "student", es: "estudiante" },
                    { en: "senior", es: "mayores" },
                    { en: "child", es: "niño" },
                    { en: "other", es: "otro" }
                ]
            },
            seating_section: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Seating Section", es: "Sección de asientos" },
                placeholder: { en: "Section A, Row 5, Seat 12", es: "Sección A, Fila 5, Asiento 12" }
            },
            quantity: { type: "number", required: true, label: { en: "Quantity Available", es: "Cantidad disponible" }, min: 1 },
            face_value: { type: "number", hidden: true, required: false, label: { en: "Face Value", es: "Valor nominal" }, min: 0 },
            transferable: { type: "boolean", hidden: true, required: false, label: { en: "Transferable", es: "Transferible" } },
            digital_ticket: { type: "boolean", required: false, label: { en: "Digital Ticket", es: "Entrada digital" } },
            parking_included: { type: "boolean", hidden: true, required: false, label: { en: "Parking Included", es: "Estacionamiento incluido" } },
            food_beverage: { type: "boolean", hidden: true, required: false, label: { en: "Food & Beverage Included", es: "Comida y bebida incluida" } },
            age_restriction: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Age Restriction", es: "Restricción de edad" },
                placeholder: { en: "18+, All ages...", es: "18+, Todas las edades..." }
            },
            dress_code: {
                type: "string",
                hidden: true,
                required: false,
                label: { en: "Dress Code", es: "Código de vestimenta" },
                placeholder: { en: "Formal, Casual, Costume...", es: "Formal, Casual, Disfraz..." }
            },
            refund_policy: {
                type: "enum",
                required: false,
                label: { en: "Refund Policy", es: "Política de reembolso" },
                options: [
                    { en: "no refunds", es: "sin reembolsos" },
                    { en: "full refund", es: "reembolso completo" },
                    { en: "partial refund", es: "reembolso parcial" },
                    { en: "exchange only", es: "solo intercambio" }
                ]
            }
        },
        search_fields: ['event_type', 'event_date', 'venue', 'city', 'ticket_type']
    },
    {
        category_key: 'tools',
        display_name: 'Tools & Equipment',
        description: 'Hand tools, power tools, construction equipment, and machinery',
        icon: '🔨',
        color: '#6B7280',
        sort_order: 17,
        basic_attributes: {},
        attributes: {
            category: {
                type: "enum",
                required: true,
                label: { en: "Tool Category", es: "Categoría de Herramienta" },
                options: [
                    { en: "hand tools", es: "herramientas manuales" },
                    { en: "power tools", es: "herramientas eléctricas" },
                    { en: "garden tools", es: "herramientas de jardín" },
                    { en: "automotive tools", es: "herramientas automotrices" },
                    { en: "construction equipment", es: "equipo de construcción" },
                    { en: "woodworking tools", es: "herramientas de carpintería" },
                    { en: "plumbing tools", es: "herramientas de plomería" },
                    { en: "electrical tools", es: "herramientas eléctricas" },
                    { en: "welding equipment", es: "equipo de soldadura" },
                    { en: "measuring tools", es: "herramientas de medición" },
                    { en: "safety equipment", es: "equipo de seguridad" },
                    { en: "cleaning equipment", es: "equipo de limpieza" },
                    { en: "other", es: "otro" }
                ]
            },
            brand: {
                type: "string",
                required: false,
                label: { en: "Brand", es: "Marca" },
                placeholder: { en: "DeWalt, Makita, Craftsman...", es: "DeWalt, Makita, Craftsman..." }
            },
            model: { type: "string", required: false, label: { en: "Model", es: "Modelo" } },
            condition: {
                type: "enum",
                required: true,
                label: { en: "Condition", es: "Condición" },
                options: [
                    { en: "new", es: "nuevo" },
                    { en: "like new", es: "como nuevo" },
                    { en: "excellent", es: "excelente" },
                    { en: "good", es: "bueno" },
                    { en: "fair", es: "regular" },
                    { en: "needs repair", es: "necesita reparación" }
                ]
            },
            power_source: {
                type: "enum",
                required: false,
                label: { en: "Power Source", es: "Fuente de energía" },
                options: [
                    { en: "manual", es: "manual" },
                    { en: "electric", es: "eléctrico" },
                    { en: "battery", es: "batería" },
                    { en: "gas", es: "gas" },
                    { en: "pneumatic", es: "neumático" },
                    { en: "hydraulic", es: "hidráulico" },
                    { en: "solar", es: "solar" }
                ]
            },
            voltage: { type: "string", hidden: true, required: false, label: { en: "Voltage", es: "Voltaje" }, placeholder: { en: "120V, 18V, 20V...", es: "120V, 18V, 20V..." } },
            battery_type: { type: "string", hidden: true, required: false, label: { en: "Battery Type", es: "Tipo de batería" }, placeholder: { en: "Li-ion, NiCd, Lead Acid...", es: "Li-ion, NiCd, Plomo-ácido..." } },
            weight: { type: "string", hidden: true, required: false, label: { en: "Weight", es: "Peso" }, placeholder: { en: "2.5kg, 5lbs...", es: "2.5kg, 5lbs..." } },
            dimensions: { type: "string", hidden: true, required: false, label: { en: "Dimensions", es: "Dimensiones" }, placeholder: { en: "30x15x10 cm", es: "30x15x10 cm" } },
            warranty: {
                type: "enum",
                hidden: true,
                required: false,
                label: { en: "Warranty", es: "Garantía" },
                options: [
                    { en: "no warranty", es: "sin garantía" },
                    { en: "30 days", es: "30 días" },
                    { en: "90 days", es: "90 días" },
                    { en: "1 year", es: "1 año" },
                    { en: "lifetime", es: "de por vida" }
                ]
            },
            accessories_included: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Accessories Included", es: "Accesorios incluidos" },
                options: [
                    { en: "case", es: "estuche" },
                    { en: "manual", es: "manual" },
                    { en: "batteries", es: "baterías" },
                    { en: "charger", es: "cargador" },
                    { en: "bits", es: "brocas" },
                    { en: "blades", es: "cuchillas" },
                    { en: "safety gear", es: "equipo de seguridad" },
                    { en: "spare parts", es: "repuestos" }
                ]
            },
            safety_features: {
                type: "array",
                hidden: true,
                required: false,
                label: { en: "Safety Features", es: "Características de seguridad" },
                options: [
                    { en: "safety switch", es: "interruptor de seguridad" },
                    { en: "guard", es: "protección" },
                    { en: "emergency stop", es: "parada de emergencia" },
                    { en: "overload protection", es: "protección contra sobrecarga" },
                    { en: "thermal protection", es: "protección térmica" },
                    { en: "dust collection", es: "recolección de polvo" }
                ]
            },
            usage_hours: { type: "number", hidden: true, required: false, label: { en: "Usage Hours", es: "Horas de uso" }, min: 0 },
            maintenance_history: { type: "string", hidden: true, required: false, label: { en: "Maintenance History", es: "Historial de mantenimiento" } },
            rental_available: { type: "boolean", hidden: true, required: false, label: { en: "Available for Rental", es: "Disponible para alquiler" } },
            delivery_available: { type: "boolean", hidden: true, required: false, label: { en: "Delivery Available", es: "Entrega disponible" } }
        },
        search_fields: ['category', 'brand', 'condition', 'power_source', 'warranty']
    },

];

const categoryKeys = defaultCategories.map(item => item.category_key);

const productIdentifiers = {
    vehicles: ['brand'],
    real_estate: ['property_type'],
    //electronics: ['brand'],
    //fashion: ['brand'],
    //foods: ['category'],
    //services: ['service_type'],
    vehicle_parts: ['part_type'],
    jobs: ['job_type', 'industry'],
    furniture: ['category', 'room'],
    books: ['author', 'genre'],
    //sports: ['sport', 'brand'],
    pets: ['animal_type'],
    collectibles: ['category'],
    health: ['category', 'brand'],
    education: ['category', 'subject'],
    events: ['event_type'],
    tools: ['category', 'brand'],
}

const subCategoriesField = {
    'electronics': 'category',
    'fashion': 'category',
    'foods': 'category',
    'furniture': 'category',
    'books': 'genre',
    'sports': 'sport',
    'services': 'service_type',
    'pets': 'animal_type',
    'jobs': 'job_type',
    'collectibles': 'category',
    'health': 'category',
    'education': 'category',
    'events': 'event_type',
    'tools': 'category',
    'vehicle_parts': 'part_type',
}

module.exports = {
    defaultCategories, categoryKeys, productIdentifiers, subCategoriesField
}
