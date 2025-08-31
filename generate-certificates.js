const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'localhost-key.pem');
const certPath = path.join(__dirname, 'localhost.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log('Generating SSL certificates...');
  
  try {
    // Generate private key
    execSync('openssl genrsa -out localhost-key.pem 2048');
    
    // Generate certificate signing request
    execSync(
      'openssl req -new -key localhost-key.pem -out localhost.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"'
    );
    
    // Generate self-signed certificate
    execSync(
      'openssl x509 -req -in localhost.csr -signkey localhost-key.pem -out localhost.pem -days 3650 -sha256'
    );
    
    // Remove CSR file
    fs.unlinkSync('localhost.csr');
    
    console.log('SSL certificates generated successfully!');
  } catch (error) {
    console.error('Error generating certificates:', error.message);
    process.exit(1);
  }
} else {
  console.log('SSL certificates already exist');
}
