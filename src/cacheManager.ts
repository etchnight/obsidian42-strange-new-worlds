// This module manages cache invalidation for the SNW plugin
// When a file is updated, we need to invalidate caches for:
// 1. The file itself (it may have new outgoing links)
// 2. All files that this file links to (they may have new incoming links)

import type { TFile, CachedMetadata } from "obsidian";

let plugin: import("./main").default;

export function setPluginVariableForCacheManager(snwPlugin: import("./main").default) {
	plugin = snwPlugin;
}

// Cache for transformed pages - imported from indexer
let cacheCurrentPages: Map<string, import("./types").TransformedCache>;

export function setCacheReference(cache: Map<string, import("./types").TransformedCache>) {
	cacheCurrentPages = cache;
}

/**
 * Invalidates cache for a specific file
 */
export function invalidateCacheForFile(file: TFile): void {
	if (cacheCurrentPages) {
		cacheCurrentPages.delete(file.path.toLocaleUpperCase());
	}
}

/**
 * Invalidates cache for multiple files
 */
export function invalidateCacheForFiles(files: TFile[]): void {
	if (cacheCurrentPages) {
		for (const file of files) {
			cacheCurrentPages.delete(file.path.toLocaleUpperCase());
		}
	}
}

/**
 * Gets all files that are linked to by a given file (based on metadata cache)
 * This includes files linked via regular links, embeds, and frontmatter links
 */
export function getLinkedFiles(file: TFile, cache: CachedMetadata): TFile[] {
	const linkedFiles: TFile[] = [];
	const seenPaths = new Set<string>();

	const processLink = (link: string) => {
		try {
			const resolved = plugin.app.metadataCache.getFirstLinkpathDest(link, file.path);
			if (resolved && !seenPaths.has(resolved.path)) {
				seenPaths.add(resolved.path);
				linkedFiles.push(resolved);
			}
		} catch (e) {
			// Ignore invalid links
		}
	};

	// Process regular links
	if (cache.links) {
		for (const link of cache.links) {
			processLink(link.link);
		}
	}

	// Process embeds
	if (cache.embeds) {
		for (const embed of cache.embeds) {
			processLink(embed.link);
		}
	}

	// Process frontmatter links
	if (cache.frontmatterLinks) {
		for (const link of cache.frontmatterLinks) {
			processLink(link.link);
		}
	}

	return linkedFiles;
}

/**
 * Invalidates cache for a file and all files it links to.
 * This should be called when a file is modified to ensure backlinks are updated.
 */
export function invalidateCacheForFileAndLinks(file: TFile, cache: CachedMetadata): void {
	const filesToInvalidate: TFile[] = [file];

	// Add all linked files
	const linkedFiles = getLinkedFiles(file, cache);
	filesToInvalidate.push(...linkedFiles);

	invalidateCacheForFiles(filesToInvalidate);
}

/**
 * Clears the entire page cache.
 * Use this for full vault reindexing.
 */
export function clearAllCache(): void {
	if (cacheCurrentPages) {
		cacheCurrentPages.clear();
	}
}
