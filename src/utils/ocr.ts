import Tesseract from 'tesseract.js'

export async function recognizeImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const result = await Tesseract.recognize(file, 'chi_sim+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  return result.data.text.trim()
}
