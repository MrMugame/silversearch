declare module '*.css';

declare module globalThis {
    async function syscall(name: string, ...args: any): Promise<any>;
    var DEFAULT_QUERY: string | undefined;
}