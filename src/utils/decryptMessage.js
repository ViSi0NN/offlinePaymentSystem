const decryptMessage = (input) => {
  let message = Buffer.from(input, 'base64').toString('utf8');
  let output = ""
  for (let i = 0; i < message.length; i++) {
      output += String.fromCharCode(message.charCodeAt(i) ^ process.env.ENCRYPTION_KEY.charCodeAt(i % process.env.ENCRYPTION_KEY.length));
  }
  console.log("output ",output);
    
  return output;
  };

export {decryptMessage}