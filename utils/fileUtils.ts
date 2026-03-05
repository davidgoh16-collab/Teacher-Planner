import mammoth from 'mammoth';

export const readFileContent = async (file: File): Promise<{ text: string, mimeType: string, isBase64: boolean }> => {
  return new Promise((resolve, reject) => {
    const fileType = file.type;

    if (fileType === 'application/pdf' || fileType === 'image/jpeg' || fileType === 'image/png' || fileType === 'image/webp') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            // Extract the base64 part
            const base64Data = result.split(',')[1];
            resolve({ text: base64Data, mimeType: fileType, isBase64: true });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    } else if (fileType === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve({ text: e.target?.result as string, mimeType: 'text/plain', isBase64: false });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
         const reader = new FileReader();
         reader.onload = async (e) => {
             try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const result = await mammoth.extractRawText({ arrayBuffer });
                resolve({ text: result.value, mimeType: 'text/plain', isBase64: false });
             } catch (err) {
                 reject(err);
             }
         };
         reader.onerror = (e) => reject(e);
         reader.readAsArrayBuffer(file);
    } else {
        reject(new Error(`Unsupported file type: ${fileType}`));
    }
  });
};