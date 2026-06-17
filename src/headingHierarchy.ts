// This module handles heading hierarchy for backlinks
// When a link points to a subheading (e.g., [[file#parent#child]]),
// it should also count as a backlink to the parent heading

import type { HeadingCache } from "obsidian";

/**
 * Parses a heading subpath and returns all heading levels in the path.
 * For example, "#parent#child" returns ["parent", "child"]
 * For a simple heading like "#heading", returns ["heading"]
 */
export function parseHeadingPath(subpath: string): string[] {
	if (!subpath || !subpath.startsWith("#")) {
		return [];
	}

	// Remove the leading # and split by #
	// "#parent#child" -> "parent#child" -> ["parent", "child"]
	// "#heading" -> "heading" -> ["heading"]
	const pathWithoutLeadingHash = subpath.substring(1);

	// Check if it's a block reference (starts with #^)
	if (pathWithoutLeadingHash.startsWith("^")) {
		return [];
	}

	// Split by # to get all heading levels
	const headings = pathWithoutLeadingHash.split("#").filter((h) => h.length > 0);

	return headings;
}

/**
 * Gets all parent headings for a given heading path.
 * For example, for "#parent#child", returns ["parent"]
 * For a simple heading like "#heading", returns []
 */
export function getParentHeadings(subpath: string): string[] {
	const allHeadings = parseHeadingPath(subpath);
	// Return all headings except the last one (which is the target heading)
	return allHeadings.slice(0, -1);
}

/**
 * Builds a map of heading hierarchy from a file's headings.
 * Returns a map where key is a heading text (uppercase) and value is array of parent heading texts (uppercase).
 */
export function buildHeadingHierarchyMap(headings: HeadingCache[] | undefined): Map<string, string[]> {
	const hierarchyMap = new Map<string, string[]>();

	if (!headings || headings.length === 0) {
		return hierarchyMap;
	}

	// Track the current parent headings at each level
	const currentParentsByLevel: Map<number, string> = new Map();

	for (const heading of headings) {
		const headingText = heading.heading.toUpperCase();
		const level = heading.level;

		// Get all parent headings (headings with lower level that came before this one)
		const parents: string[] = [];
		for (const [parentLevel, parentText] of currentParentsByLevel) {
			if (parentLevel < level) {
				parents.push(parentText);
			}
		}

		// Store the hierarchy for this heading
		if (parents.length > 0) {
			hierarchyMap.set(headingText, parents);
		}

		// Update current parents - remove any siblings or children
		for (const [parentLevel] of currentParentsByLevel) {
			if (parentLevel >= level) {
				currentParentsByLevel.delete(parentLevel);
			}
		}

		// Add this heading as a potential parent for future headings
		currentParentsByLevel.set(level, headingText);
	}

	return hierarchyMap;
}

/**
 * Gets all heading keys that should receive a backlink when linking to a specific heading.
 * This includes the target heading itself and all its parent headings.
 *
 * @param filePath - The file path (uppercase)
 * @param subpath - The subpath (e.g., "#parent#child" or "#heading")
 * @param fileHeadings - The headings in the target file (to determine hierarchy)
 * @returns Array of full keys (e.g., ["FILE.MD#CHILD", "FILE.MD#PARENT"])
 */
export function getAllBacklinkKeysForHeading(
	filePath: string,
	subpath: string,
	fileHeadings: HeadingCache[] | undefined,
): string[] {
	const keys: string[] = [];

	if (!subpath || !subpath.startsWith("#") || subpath.startsWith("#^")) {
		return keys;
	}

	// Parse the heading path
	const headingPath = parseHeadingPath(subpath);
	if (headingPath.length === 0) {
		return keys;
	}

	// The target heading (last in the path)
	const targetHeading = headingPath[headingPath.length - 1].toUpperCase();
	keys.push(`${filePath}#${targetHeading}`);

	// If there are explicit parent headings in the link (e.g., #parent#child)
	// add those as well
	if (headingPath.length > 1) {
		for (let i = 0; i < headingPath.length - 1; i++) {
			const parentHeading = headingPath[i].toUpperCase();
			keys.push(`${filePath}#${parentHeading}`);
		}
	}

	// Also check the file's heading hierarchy to find implicit parents
	// (a link to a subheading should also count as a link to its parent headings)
	if (fileHeadings && fileHeadings.length > 0) {
		const hierarchyMap = buildHeadingHierarchyMap(fileHeadings);
		const parents = hierarchyMap.get(targetHeading);
		if (parents) {
			for (const parent of parents) {
				const parentKey = `${filePath}#${parent}`;
				if (!keys.includes(parentKey)) {
					keys.push(parentKey);
				}
			}
		}
	}

	return keys;
}
