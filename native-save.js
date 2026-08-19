function getPlugin(capacitor, name) {
  return capacitor?.[name] || capacitor?.Plugins?.[name];
}

export function createSkinFilename(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `skinburp-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.png`;
}

export function isShareCancellation(error) {
  return /cancell?ed/i.test(error.message);
}

export async function savePngNatively(capacitor, data, filename) {
  const skinSaver = getPlugin(capacitor, 'SkinSaver');
  if (typeof skinSaver?.save === 'function') {
    const result = await skinSaver.save({ data, filename });
    if (result.saved) return result;
  }

  const filesystem = getPlugin(capacitor, 'Filesystem');
  const share = getPlugin(capacitor, 'Share');

  if (typeof filesystem?.writeFile !== 'function') {
    throw new Error('The Android file service is unavailable.');
  }
  if (typeof share?.share !== 'function') {
    throw new Error('The Android save service is unavailable.');
  }

  const result = await filesystem.writeFile({
    path: filename,
    data,
    directory: 'CACHE'
  });
  try {
    await share.share({
      title: 'Save skin',
      files: [result.uri],
      dialogTitle: 'Save or share skin'
    });
    return { saved: true };
  } catch (error) {
    if (isShareCancellation(error)) return { saved: false };
    throw error;
  }
}
