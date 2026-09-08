import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const CatGameView = dynamic(() => import('../components/CatView'), {
	ssr: false,
});

export default function MapPage() {
	const router = useRouter();
	return <CatGameView code={router.query.code} />;
}
