const fs = require('fs');
const path = require('path');

// Download Apple Root Certificates from https://www.apple.com/certificateauthority/
// Save them as PEM files in your project
function loadAppleRootCertificates() {
    const certPaths = [
        path.join(__dirname, '../../certificates/AppleRootCA-G2.cer'),
        path.join(__dirname, '../../certificates/AppleRootCA-G3.cer')
    ];
    
    return certPaths.map(certPath => {
        if (fs.existsSync(certPath)) {
            return fs.readFileSync(certPath);
        }
        throw new Error(`Apple root certificate not found: ${certPath}`);
    });
}

module.exports = { loadAppleRootCertificates };