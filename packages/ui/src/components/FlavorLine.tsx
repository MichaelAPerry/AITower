import type { Flavor } from "@aitower/content";

/** A quiet real quotation with its author; the citation shows on hover. Renders nothing without a quote. */
export function FlavorLine({ flavor, className = "" }: { flavor?: Flavor; className?: string }) {
	if (!flavor) return null;
	return (
		<figure className={`ui-flavor ${className}`.trim()} title={flavor.source ?? flavor.author} data-flavor>
			<blockquote className="ui-flavor-q">{`“${flavor.quote}”`}</blockquote>
			<figcaption className="ui-flavor-by">{`— ${flavor.author}`}</figcaption>
		</figure>
	);
}
