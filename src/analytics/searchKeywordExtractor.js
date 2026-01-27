/* eslint-disable max-len */

const stopWords = new Set([
    // --- ENGLISH STOPWORDS ---
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
    'this', 'that', "that'll", 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'a', 'an', 'the',
    'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'although', 'though', 'since', 'unless', 'whereas',
    'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'near', 'around', 'beside', 'behind', 'across', 'among', 'within', 'without', 'toward', 'towards',
    'again', 'further', 'then', 'once', 'here', 'there', 'now', 'very', 'really', 'quite', 'just', 'only', 'also', 'too', 'even', 'still', 'already', 'yet', 'ever', 'never', 'always', 'often', 'sometimes', 'usually', 'rarely', 'seldom',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'many', 'much', 'several', 'enough', 'little', 'less',
    'own', 'same', 'so', 'than',
    'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'ought',
    's', 't', 'd', 'll', 'm', 'o', 're', 've', 'y',
    'ain', 'aren', "aren't", 'couldn', "couldn't", 'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't", 'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't", 'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't",
    'want', 'wanted', 'wanting', 'need', 'needed', 'needing', 'looking', 'look', 'find', 'finding', 'found', 'search', 'searching', 'searched', 'buy', 'buying', 'bought', 'purchase', 'purchasing', 'purchased', 'get', 'getting', 'got', 'gotten', 'shop', 'shopping', 'shopped', 'order', 'ordering', 'ordered', 'sell', 'selling', 'sold',
    'go', 'going', 'went', 'gone', 'come', 'coming', 'came', 'make', 'making', 'made', 'take', 'taking', 'took', 'taken', 'see', 'seeing', 'saw', 'seen', 'know', 'knowing', 'knew', 'known', 'think', 'thinking', 'thought', 'give', 'giving', 'gave', 'given', 'use', 'using', 'used', 'work', 'working', 'worked', 'call', 'calling', 'called', 'try', 'trying', 'tried', 'ask', 'asking', 'asked', 'feel', 'feeling', 'felt', 'become', 'becoming', 'became', 'leave', 'leaving', 'left', 'put', 'putting', 'seem', 'seeming', 'seemed', 'keep', 'keeping', 'kept', 'let', 'letting', 'begin', 'beginning', 'began', 'begun', 'help', 'helping', 'helped', 'show', 'showing', 'showed', 'shown', 'hear', 'hearing', 'heard', 'play', 'playing', 'played', 'run', 'running', 'ran', 'move', 'moving', 'moved', 'live', 'living', 'lived', 'believe', 'believing', 'believed', 'bring', 'bringing', 'brought', 'happen', 'happening', 'happened', 'write', 'writing', 'wrote', 'written', 'sit', 'sitting', 'sat', 'stand', 'standing', 'stood', 'lose', 'losing', 'lost', 'pay', 'paying', 'paid', 'meet', 'meeting', 'met', 'include', 'including', 'included', 'continue', 'continuing', 'continued', 'set', 'setting', 'learn', 'learning', 'learned', 'learnt', 'change', 'changing', 'changed', 'lead', 'leading', 'led', 'understand', 'understanding', 'understood', 'watch', 'watching', 'watched', 'follow', 'following', 'followed', 'stop', 'stopping', 'stopped', 'create', 'creating', 'created', 'speak', 'speaking', 'spoke', 'spoken', 'read', 'reading', 'allow', 'allowing', 'allowed', 'add', 'adding', 'added', 'spend', 'spending', 'spent', 'grow', 'growing', 'grew', 'grown', 'open', 'opening', 'opened', 'walk', 'walking', 'walked', 'win', 'winning', 'won', 'offer', 'offering', 'offered', 'remember', 'remembering', 'remembered', 'love', 'loving', 'loved', 'consider', 'considering', 'considered', 'appear', 'appearing', 'appeared', 'actually', 'carry', 'carrying', 'carried', 'break', 'breaking', 'broke', 'broken', 'receive', 'receiving', 'received', 'agree', 'agreeing', 'agreed', 'support', 'supporting', 'supported', 'hit', 'hitting',
    'please', 'thanks', 'thank', 'hello', 'hi', 'hey', 'yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'well', 'um', 'uh', 'oh', 'ah',
    'today', 'yesterday', 'tomorrow', 'tonight', 'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month', 'year', 'time', 'soon', 'later', 'early', 'late',
    'thing', 'things', 'something', 'anything', 'nothing', 'everything', 'someone', 'anyone', 'everyone', 'nobody', 'somebody', 'anybody', 'everybody', 'somewhere', 'anywhere', 'everywhere', 'nowhere', 'way', 'ways', 'maybe', 'perhaps', 'probably', 'possibly', 'definitely', 'certainly', 'surely',

    // --- SPANISH STOPWORDS ---
    // Artículos
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del',
    // Pronombres
    'yo', 'tu', 'el', 'ella', 'ello', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'usted', 'ustedes', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'mio', 'mia', 'mios', 'mias', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
    // Preposiciones
    'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'segun', 'sin', 'so', 'sobre', 'tras', 'versus', 'via',
    // Conjunciones
    'y', 'e', 'ni', 'o', 'u', 'pero', 'mas', 'sino', 'porque', 'pues', 'aunque', 'si', 'como', 'cuando', 'donde', 'quien', 'que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas',
    // Verbos comunes / Auxiliares
    'ser', 'soy', 'eres', 'es', 'somos', 'sois', 'son', 'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron', 'era', 'eras', 'eramos', 'erais', 'eran', 'sera', 'seras', 'seremos', 'sereis', 'seran', 'sido', 'siendo',
    'estar', 'estoy', 'esta', 'estas', 'estamos', 'estais', 'estan', 'estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron', 'estaba', 'estabas', 'estabamos', 'estabais', 'estaban', 'estara', 'estaras', 'estaremos', 'estareis', 'estaran', 'estado', 'estando',
    'haber', 'he', 'has', 'ha', 'hemos', 'habeis', 'han', 'hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron', 'habia', 'habias', 'habiamos', 'habiais', 'habian', 'habra', 'habras', 'habremos', 'habreis', 'habran', 'habido', 'habiendo',
    'tener', 'tengo', 'tienes', 'tiene', 'tenemos', 'teneis', 'tienen', 'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron', 'tenia', 'tenias', 'teniamos', 'teniais', 'tenian', 'tendra', 'tendras', 'tendremos', 'tendreis', 'tendran', 'tenido', 'teniendo',
    'hacer', 'hago', 'haces', 'hace', 'hacemos', 'haceis', 'hacen', 'hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron', 'hacia', 'hacias', 'haciamos', 'haciais', 'hacian', 'hare', 'haras', 'haremos', 'hareis', 'haran', 'hecho', 'haciendo',
    // Action/Intent verbs (shopping related)
    'querer', 'quiero', 'quieres', 'quiere', 'queremos', 'quereis', 'quieren', 'queria', 'querias', 'queriamos', 'queriais', 'querian', 'quise', 'quisiste', 'quiso', 'quisimos', 'quisisteis', 'quisieron', 'quisiera', 'quisieras', 'quisieramos', 'quisierais', 'quisieran',
    'buscar', 'busco', 'buscas', 'busca', 'buscamos', 'buscais', 'buscan', 'buscaba', 'buscabas', 'buscabamos', 'buscabais', 'buscaban', 'busque', 'buscaste', 'busco', 'buscamos', 'buscasteis', 'buscaron',
    'necesitar', 'necesito', 'necesitas', 'necesita', 'necesitamos', 'necesitais', 'necesitan', 'necesitaba', 'necesitaba', 'necesitabamos', 'necesitabais', 'necesitaban', 'necesite', 'necesitaste', 'necesito', 'necesitamos', 'necesitasteis', 'necesitaron',
    'comprar', 'compro', 'compras', 'compra', 'compramos', 'comprais', 'compran', 'compraba', 'comprabas', 'comprabamos', 'comprabais', 'compraban', 'compre', 'compraste', 'compro', 'compramos', 'comprasteis', 'compraron',
    'encontrar', 'encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontrais', 'encuentran', 'encontraba', 'encontrabas', 'encontrabamos', 'encontrabais', 'encontraban', 'encontre', 'encontraste', 'encontro', 'encontramos', 'encontrasteis', 'encontraron',
    'desear', 'deseo', 'deseas', 'desea', 'deseamos', 'deseais', 'desean',
    'ver', 'veo', 'ves', 've', 'vemos', 'veis', 'ven', 'vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron',
    'mirar', 'miro', 'miras', 'mira', 'miramos', 'mirais', 'miran',
    'conseguir', 'consigo', 'consigues', 'consigue', 'conseguimos', 'conseguis', 'consiguen',
    // Adverbios / Otros
    'aqui', 'ahi', 'alli', 'alla', 'aca', 'ahora', 'ya', 'todavia', 'aun', 'muy', 'mucho', 'poco', 'bastante', 'mas', 'menos', 'tan', 'tanto', 'asi', 'bien', 'mal', 'siempre', 'nunca', 'jamas', 'tampoco', 'tambien', 'quizas', 'talvez', 'acaso',
    'hola', 'adios', 'gracias', 'porfavor', 'bueno', 'malo',
    'cosa', 'cosas', 'algo', 'nada', 'todo', 'alguien', 'nadie', 'todos', 'algun', 'ningun', 'otro', 'otra', 'otros', 'otras'
]);

/**
 * Extracts keywords from text by removing stop words and normalizing
 * @param {string} text 
 * @returns {string} Space separated keywords
 */
function extractKeywords(text) {
    if (!text) return '';

    // 1. Normalize and Lowercase
    // NFD decomposition separates diacritics (accents) from letters
    // replace(/[\u0300-\u036f]/g, "") removes the diacritics
    let processed = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // 2. Remove special characters but keep numbers and spaces
    // This regex replaces anything that is NOT a letter, number, or whitespace with an empty string
    // Since we removed accents, [a-z] covers spanish letters converted to ascii
    processed = processed.replace(/[^a-z0-9\s]/g, '');

    // 3. Split into words
    const words = processed.split(/\s+/);

    // 4. Filter out stop words
    const keywords = words.filter(word => word.length > 0 && !stopWords.has(word));

    return keywords.join(' ');
}

module.exports = {
    extractKeywords
};
