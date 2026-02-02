/**
 * Array Utilities - Zero-allocation array manipulation
 * EIDOLON-V: Performance-critical utilities for game loop
 */

/**
 * Filter array in-place without creating new array
 * Zero-allocation filter for hot paths
 * 
 * @param arr - The array to filter
 * @param predicate - Function that returns true to keep element
 */
export function filterInPlace<T>(arr: T[], predicate: (item: T, index: number) => boolean): void {
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < arr.length; readIndex++) {
        if (predicate(arr[readIndex], readIndex)) {
            if (writeIndex !== readIndex) {
                arr[writeIndex] = arr[readIndex];
            }
            writeIndex++;
        }
    }

    arr.length = writeIndex;
}

/**
 * Remove element at index in-place (swap with last, then pop)
 * O(1) removal for unordered arrays
 */
export function removeAtSwap<T>(arr: T[], index: number): T | undefined {
    if (index < 0 || index >= arr.length) return undefined;

    const removed = arr[index];
    const last = arr.length - 1;

    if (index !== last) {
        arr[index] = arr[last];
    }

    arr.pop();
    return removed;
}

/**
 * Binary search for sorted array
 * Returns insertion index if not found
 */
export function binarySearch<T>(arr: T[], target: T, compare: (a: T, b: T) => number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const cmp = compare(arr[mid], target);

        if (cmp < 0) {
            low = mid + 1;
        } else if (cmp > 0) {
            high = mid - 1;
        } else {
            return mid; // Found
        }
    }

    return ~low; // Not found, return bitwise complement of insertion point
}
