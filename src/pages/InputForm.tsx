import { useNavigate, useParams} from "@solidjs/router";
import {createSignal, Show} from "solid-js";
import {FormStages, PostTypes} from "../types/Stages";
import {aspectRatio, capitalize} from "../types/Utils";

function InputForm() {
    const params = useParams();
    const navigate = useNavigate();

    const [postType, setPostType] = createSignal(PostTypes.UNSET);
    setPostType(PostTypes[params.type.toUpperCase() as keyof typeof PostTypes] || PostTypes.UNSET);



    const [activePanel, setActivePanel] = createSignal(FormStages.GENERAL);

    let data = {
        title: "",
        subtitle: "",
        content: "",
        author: "",
        img: ""
    }
    console.info(params.load);

    if(params.load === "load") {
        console.log("loading data");
        const post = localStorage.getItem("post");
        if(post) {
            data = JSON.parse(post);
        }
    }

    function saveData() {
        console.log(data);
        // save to local storage
        localStorage.setItem("post", JSON.stringify(data));
        // redirect to home
        navigate("/creator/" + params.type.toLowerCase(), {replace: false});
    }

    function switchPanel(direction_up: boolean) {
        const currentPanel = activePanel();
        if (direction_up) {
            if (currentPanel == FormStages.GENERAL) {
                setActivePanel(FormStages.CONTENT);
            } else if (currentPanel == FormStages.CONTENT) {
                setActivePanel(FormStages.IMAGE);
            }
        } else {
            if (currentPanel == FormStages.CONTENT) {
                setActivePanel(FormStages.GENERAL);
            } else if (currentPanel == FormStages.IMAGE) {
                setActivePanel(FormStages.CONTENT);
            }
        }
    }
    return (
        <div class="flex flex-col gap-5 items-center h-screen p-4 min-sm:w-2xl">
            <div class="join">
                <button onclick={() => setActivePanel(FormStages.GENERAL)} class="join-item btn btn-active">1</button>
                <button onclick={() => setActivePanel(FormStages.CONTENT)} class="join-item btn ">2</button>
                <button onclick={() => setActivePanel(FormStages.IMAGE)} class="join-item btn">3</button>
            </div>
            <form class="p-4 w-full max-sm:min-w-screen h-full grow ">
                <Show when={activePanel() == FormStages.GENERAL}>
                    <div class="flex flex-col gap-3">
                        <div class="mb-2">
                            <h2 class="text-xl font-bold">General Information</h2>
                            <p>Provide the necessary information for the post</p>
                        </div>

                        <label class="input h-12 w-full">
                            <span class="label min-w-[25%]">Title</span>
                            <input onchange={
                                (e) => {
                                    data.title = e.currentTarget.value;
                                }
                            } type="text" value={data.title} placeholder="Title" required={true}/>
                        </label>

                        <label class="input h-12 w-full">
                            <span class="label min-w-[25%]">Subtitle</span>
                            <input onchange={
                                (e) => {
                                    data.subtitle = e.currentTarget.value;
                                }
                            } type="text" value={data.subtitle} placeholder="Subtitle"/>
                        </label>
                    </div>
                </Show>
                <Show when={activePanel() == FormStages.CONTENT}>
                    <div class="flex flex-col gap-3">
                        <div class="mb-2">
                            <h2 class="text-xl font-bold">Content</h2>
                            <p>
                                Provide the content for the post.
                            </p>
                        </div>

                        <label class="input h-fit w-full flex flex-row">
                            <span class="label min-w-[25%]">Content</span>
                            <textarea value={data.content} onchange={
                                (e) => {
                                    data.content = e.currentTarget.value;
                                }
                            } class="textarea textarea-ghost" placeholder="Content" required={true}></textarea>
                        </label>

                        <Show when={postType() == PostTypes.QUOTE}>
                            <label class="input w-full h-12">
                                <span class="label min-w-[25%] h-full">Author</span>
                                <input value={data.author} onchange={
                                    (e) => {
                                        data.author = e.currentTarget.value;
                                    }
                                } type="text" placeholder="Author "/>
                            </label>
                        </Show>
                    </div>
                </Show>
                <Show when={activePanel() == FormStages.IMAGE}>
                    <div class="flex flex-col gap-3 ">
                        <div class="mb-2">
                            <h2 class="text-xl font-bold">Image</h2>
                            <p>Provide the image for the post</p>
                        </div>

                        <label class="input w-full h-12">
                            <span class="label min-w-[25%]">Image URL</span>
                            <input onchange={
                                (e) => {
                                    // data.img = e.currentTarget.value;
                                }
                            } type="text" placeholder="Not implemented"/>
                        </label>
                        <div class="divider">OR</div>
                        <label class="input h-12 w-full">
                            <span class="label min-w-[25%]">Image</span>
                            <input accept="image/*" oninput={
                                (e) => {
                                    // @ts-ignore
                                    const file = e.target.files[0];
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        aspectRatio(1080, 1080, e.target?.result as string).then((res) => {
                                            data.img = res;
                                        });
                                    }
                                    reader.readAsDataURL(file);
                                }
                            } type="file" class="file-input file-input-ghost w-full max-w-xs" placeholder="Image"/>
                        </label>
                    </div>
                </Show>
            </form>
            <div class="join">
                <button onclick={() => switchPanel(false)} class={`join-item btn ${activePanel() != FormStages.GENERAL ? "btn-primary" : "btn-disabled"}`}> Previous</button>
                <div class="text-center join-item bg-base-200 p-2 w-32">{capitalize(activePanel())}</div>
                <button onclick={() => activePanel() == FormStages.IMAGE ? saveData() : switchPanel(true)} class={`join-item btn ${activePanel() != FormStages.IMAGE ? "btn-primary" : "btn-success"}`}>{activePanel() != FormStages.IMAGE ? "Next" : "Finish"}</button>
            </div>
        </div>
    );
}

export default InputForm;