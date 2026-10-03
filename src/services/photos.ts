/** @file 浏览器照片解码和压缩；返回本地数据地址，不上传文件、不修改文档。 */
export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    try {
      await image.decode()
    } catch {
      throw new Error('无法读取这张图片。')
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效。')
    // 最长边 640px、JPEG 质量 0.86；限制照片在数据库和备份中的体积。
    const ratio = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理照片。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(source)
  }
}
