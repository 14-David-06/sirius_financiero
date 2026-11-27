import puppeteer, { type PDFOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const CHROME_LOCAL: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
};

async function abrirNavegador() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return puppeteer.launch({
    headless: true,
    executablePath: CHROME_LOCAL[process.platform] ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function htmlAPdf(html: string, opciones: PDFOptions): Promise<Uint8Array> {
  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();
    await pagina.setContent(html, { waitUntil: 'load', timeout: 30000 });
    return await pagina.pdf(opciones);
  } finally {
    await navegador.close();
  }
}
