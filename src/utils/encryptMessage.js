const encryptMessage = async (message)=>{
    let output = '';
    for (let i = 0; i < message.length; i++) {
        output += String.fromCharCode(message.charCodeAt(i) ^ process.env.ENCRYPTION_KEY.charCodeAt(i % process.env.ENCRYPTION_KEY.length));
    }

    const encrypted = Buffer.from(output, 'utf8').toString('base64');
    console.log("encrypted ",encrypted);
    
    
    return encrypted;
}

export {encryptMessage}