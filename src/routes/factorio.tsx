import { Component, JSXElement } from "solid-js";
import { A, Outlet, Title } from "solid-start";


const NavLink: Component<{ href: string, children: JSXElement }> = (props) => (
    <li class={`border-b-2 border-transparent hover:border-sky-600 mx-1.5 sm:mx-6`}>
        <A href={props.href}>{props.children}</A>
    </li>
);

const Layout = () => {
    return <>
        <nav class="bg-sky-800">
            <ul class="container flex items-center p-3 text-gray-200">
                <NavLink href="/factorio/build-everything">Build Everything Generator</NavLink>
                <NavLink href="/factorio/blueprint-converter">Blueprint Converter</NavLink>
                <NavLink href="/factorio/blueprint-analyzer">Blueprint Analyzer</NavLink>
            </ul>
        </nav>
        <Title>Factorio | Gaming Tools</Title>
        <Outlet />
    </>
};

export default Layout;
