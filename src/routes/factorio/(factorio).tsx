import { A, Title } from "solid-start";

const Page = () => {
    return (
        <div class="w-full max-w-[36rem] m-auto">
            <Title>Factorio | Gaming Tools</Title>
            <div class="m-12 dui-card w-full bg-base-100 shadow-xl">
                <div class="dui-card-body">
                    <h2 class="dui-card-title">"Make Everything" Blueprint Generator</h2>
                    <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Cum, facere commodi architecto tempora inventore vitae quibusdam ipsum? Necessitatibus illo, eius ut voluptas nemo, provident, veritatis laborum dignissimos reprehenderit cumque autem?</p>
                    <div class="dui-card-actions justify-end">
                        <A href="/factorio/make-everything-generator" class="dui-btn dui-btn-primary">Open</A>
                    </div>
                </div>
            </div>
            <div class="m-12 dui-card w-full bg-base-100 shadow-xl">
                <div class="dui-card-body">
                    <h2 class="dui-card-title">Blueprint Entities and Items to Constant Combinator</h2>
                    <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Dicta inventore nostrum dignissimos. Nobis voluptatum, nostrum error enim magnam aliquid et dolorem libero optio laboriosam voluptatem sit voluptates quidem sequi placeat.</p>
                    <div class="dui-card-actions justify-end">
                        <A href="/factorio/blueprint-to-constant-combinator" class="dui-btn dui-btn-primary">Open</A>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Page;
