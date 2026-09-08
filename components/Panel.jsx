export default function Panel({ children, className = '' }) {
	return <section className={`lobby-panel ${className}`}>{children}</section>;
}
