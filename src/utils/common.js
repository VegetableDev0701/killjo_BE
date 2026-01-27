

function generateError(message, status = 500, details = {}) {
    const error = new Error(message);
    error.status = status;
    error.details = details;
    return error;
}

function sendErrorResponse(res, error, message = 'Internal Server Error') {
    const status = error.status || 500;
    const msg = error.message || message;
    const details = error.details || {};
    
    res.status(status).json({
        status: 'error',
        message: msg,
        ...details
    });
}

module.exports = {
    generateError,
    sendErrorResponse
};