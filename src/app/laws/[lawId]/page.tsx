import fs from 'node:fs/promises';
import path from 'node:path';
import LawDetailPage from './law-detail-client';

interface CatalogFile {
  laws: Array<{ id: string }>;
}

async function readCatalog(): Promise<CatalogFile> {
  const files = await fs.readdir(path.join(process.cwd(), 'public/data/v'));
  const version = files.sort().at(-1);
  if (!version) return { laws: [] };
  const source = await fs.readFile(path.join(process.cwd(), 'public/data/v', version, 'catalog.json'), 'utf8');
  return JSON.parse(source) as CatalogFile;
}

export async function generateStaticParams() {
  const catalog = await readCatalog();
  return catalog.laws.map((law) => ({ lawId: law.id }));
}

export const dynamicParams = false;

export default function Page() {
  return <LawDetailPage />;
}

export const dynamic = 'force-static';

export const metadata = {
  title: 'قانون | کتابچه قانون ایران',
};
