import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"

async function mountModal() {
    const path: Promise<string> = syscall("editor.getCurrentPath");
    const isDocumentEditor: Promise<string> = syscall("editor.getCurrentEditor");
    const customStyles = syscall("editor.getUiOption", "customStyles");

    await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 75)),
        new Promise((resolve) => {
            const element = document.querySelector("link#stylesheet");

            if (!element) return;

            (element as HTMLLinkElement).onload = resolve;
        })
    ]);

    mount(Modal, {
        target: document.querySelector("#container")!,
        props: {
            defaultQuery: globalThis.DEFAULT_QUERY ?? "",
            currentPath: await path,
            customStyles: await customStyles,
        },
        context: new Map([
            ["isDocumentEditor", (await isDocumentEditor) !== "page"]
        ])
    });
}

mountModal();