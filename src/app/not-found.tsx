import Link from 'next/link';
export default function NotFound() {
  return (<section className="prose"><h1>Not found</h1><p><Link href="/">Back to all materials</Link></p></section>);
}
