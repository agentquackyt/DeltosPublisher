import {createSignal, onMount, Show} from "solid-js";
import {useNavigate, useParams} from "@solidjs/router";
import {PostTypes} from "../types/Stages";

interface PostData {
    title: string;
    subtitle: string;
    content: string;
    author: string;
    img?: string;
    imgBinary?: File;
}

interface RenderOptions {
    fontSize: number;
    fontFamily: TextOptions;
    textColor: TextOptions;
    imageOptions: ImageOptions;
    lineHeight: number;
    backgroundColor?: string;
}

interface TextOptions {
    title: string;
    subtitle: string;
    content: string;
}

interface ImageOptions {
    rotation: number;
    size: number;
    x: number;
    y: number;
    radius: number;
}

function RenderSite() {
    const params = useParams();
    const navigate = useNavigate();

    const [postType, setPostType] = createSignal(PostTypes.UNSET);
    setPostType(PostTypes[params.type.toUpperCase() as keyof typeof PostTypes] || PostTypes.UNSET);

    const [fileDataURL, setFileDataURL] = createSignal("");
    const [logoDataURL, setLogoDataURL] = createSignal("");
    let logoMultipler = 10;

    const [post, setPost] = createSignal<PostData>({title: "", subtitle: "", content: "", author: ""});
    let canvasRef: HTMLCanvasElement | undefined;
    const [toggleMenu, setToggleMenu] = createSignal(true);

    const render: RenderOptions = {
        fontSize: 50,
        fontFamily: {
            content: 'Franklin Gothic Medium',
            title: 'Franklin Gothic Heavy',
            subtitle: 'Franklin Gothic Heavy'
        },
        textColor: {
            title: '#009fe3',
            subtitle: '#cd0070',
            content: '#003399'
        },
        imageOptions: {
            rotation: 2,
            size: 450,
            x: 0,
            y: 0,
            radius: 20
        },
        backgroundColor: '#fff',
        lineHeight: 1.2
    };

    const [imageOptionState, setImageOptionState] = createSignal(render.imageOptions, { equals: false });

    // Initialize post from localStorage
    onMount(() => {
        const savedPost = localStorage.getItem("post");
        if (savedPost) {
            const postObject: PostData = JSON.parse(savedPost);
            if (postObject.img?.startsWith("data:")) {
                setFileDataURL(postObject.img);
            }
            setPost(postObject);
        }

        // Initialize logo from localStorage
        const savedLogo = localStorage.getItem("logo");
        if (savedLogo) {
            const logoObject = JSON.parse(savedLogo);
            if (logoObject.logoDataURL?.startsWith("data:")) {
                setLogoDataURL(logoObject.logoDataURL);
            }
            logoMultipler = logoObject.logoMultipler;
        }

        // Initialize color options from localStorage
        const savedColors = localStorage.getItem("colors");
        if (savedColors) {
            const colors = JSON.parse(savedColors);
            render.textColor.title = colors.title;
            render.textColor.subtitle = colors.subtitle;
            render.textColor.content = colors.content;
            render.backgroundColor = colors.background;
        }

        // Initialize font options from localStorage
        const savedFonts = localStorage.getItem("fonts");
        if (savedFonts) {
            const fonts = JSON.parse(savedFonts);
            render.fontFamily.title = fonts.title;
            render.fontFamily.subtitle = fonts.subtitle;
            render.fontFamily.content = fonts.content;
        }

        // Initialize image options from localStorage
        const savedImageOptions = localStorage.getItem("imageOptions");
        if (savedImageOptions) {
            const imageOptions = JSON.parse(savedImageOptions);
            render.imageOptions = imageOptions;
            setImageOptionState(imageOptions);
        }
    });

    async function generateSocialMediaPost(
        canvas: HTMLCanvasElement,
        options: RenderOptions
    ) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const config = options || {
            fontSize: 20,
            fontFamily: {
                title: 'Arial',
                subtitle: 'Segoe UI Black Italic',
                content: 'Arial'
            },
            textColor: {
                title: '#009fe3',
                subtitle: '#ffed00',
                content: '#e6007e'
            },
            imageOptions: {
                rotation: 0,
                size: 450,
                x: 50,
                y: 50,
                radius: 30
            },
            backgroundColor: '#ffffff',
            lineHeight: 1.2
        };

        const wrapText = (text: string, maxWidth: number) => {
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx!.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set background color
        if (config.backgroundColor) {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Set text styles
        ctx.fillStyle = config.textColor.title;
        ctx.font = `${config.fontSize}px ${config.fontFamily.title}`;
        const lineHeight = config.fontSize * config.lineHeight;

        // Draw text elements
        const currentPost = post();
        let yPosition = 100;

        // Title
        ctx.font = `bold ${config.fontSize * 1.3}px ${config.fontFamily.title}`;
        ctx.fillText(currentPost.title, 50, yPosition);
        yPosition += lineHeight + 20;

        // Subtitle
        ctx.fillStyle = config.textColor.subtitle;
        ctx.font = `${config.fontSize * 1.1}px ${config.fontFamily.subtitle}`;
        ctx.fillText(currentPost.subtitle, 50, yPosition);
        yPosition += lineHeight * 2;


        ctx.fillStyle = config.textColor.content;
        ctx.font = `${config.fontSize}px ${config.fontFamily.content}`;
        // Content with wrapping
        const contentLines = wrapText(currentPost.content, canvas.width - 100);
        contentLines.forEach(line => {
            ctx.fillText(line, 50, yPosition);
            yPosition += lineHeight;
        });

        // Author
        ctx.fillStyle = config.textColor.subtitle;
        ctx.font = `${config.fontSize}px ${config.fontFamily.subtitle}`;
        console.log(postType());
        if (postType() == PostTypes.QUOTE) ctx.fillText(`- ${currentPost.author}`, 50, yPosition + 50);

        // Draw image with effects
        if (fileDataURL()) {
            const img = new Image();
            img.src = fileDataURL();
            await new Promise(resolve => img.onload = resolve);

            console.log("Image loaded");
            console.info("Image options", config.imageOptions);
            // Image positioning and sizing
            const imgSize = options.imageOptions.size || 450; // Size of the square image
            const margin = -5;   // Margin from edges
            const rotation = options.imageOptions.rotation * Math.PI / 180; // 15 degrees in radians

            // Save context state before transformation
            ctx.save();

            // Position to bottom right corner
            const x = canvas.width - imgSize - margin - options.imageOptions.x;
            const y = canvas.height - imgSize - margin - options.imageOptions.y;

            // Move to center of image position
            ctx.translate(x + imgSize / 2, y + imgSize / 2);
            ctx.rotate(rotation);

            // Create rounded rectangle clip path
            ctx.beginPath();
            ctx.roundRect(
                -imgSize / 2, // x
                -imgSize / 2, // y
                imgSize,    // width
                imgSize,    // height
                options.imageOptions.radius // border radius
            );
            ctx.clip();

            // Draw rotated and clipped image
            ctx.drawImage(
                img,
                -imgSize / 2,          // x
                -imgSize / 2,          // y
                imgSize,             // width
                imgSize              // height
            );

            // Restore context state
            ctx.restore();

            // render logo image at bottom left corner with width 1/3 of the page
            const logo = new Image();
            if (logoDataURL().length > 0) {
                logo.src = logoDataURL();
            } else {
                logo.crossOrigin = "Anonymous"; // This is important for CORS
                logo.src = `https://upload.wikimedia.org/wikipedia/commons/f/f5/Image_manquante_2.svg`;
            }

            await new Promise(resolve => logo.onload = resolve);
            // aspect ratio of the logo
            const aspectRatio = logo.width / logo.height;
            const logoWidth = (canvas.width / 5) * (logoMultipler / 25 * 2);

            ctx.drawImage(logo, 50, canvas.height - 50 - logoWidth / aspectRatio, logoWidth, logoWidth / aspectRatio);
        }
    }

    const handleDownload = async () => {
        if (!canvasRef) return;
        await generateSocialMediaPost(canvasRef, render);
        const link = document.createElement('a');
        link.download = `social-post_${Date.now()}.png`;
        link.href = canvasRef.toDataURL('image/png');
        link.click();
    };

    function updatePost() {
        // update image options state
        setImageOptionState(render.imageOptions);
        if (canvasRef) {
            generateSocialMediaPost(canvasRef, render).then(() => console.log("Generated"))
        }
    }

    Promise.resolve().then(updatePost);

    function updateTextColors() {
        localStorage.setItem("colors", JSON.stringify({
            title: render.textColor.title,
            subtitle: render.textColor.subtitle,
            content: render.textColor.content,
            background: render.backgroundColor
        }));
        updatePost();
    }

    function updateFonts() {
        localStorage.setItem("fonts", JSON.stringify({
            title: render.fontFamily.title,
            subtitle: render.fontFamily.subtitle,
            content: render.fontFamily.content
        }));
        updatePost();
    }

    function updateImageOptions() {
        localStorage.setItem("imageOptions", JSON.stringify(render.imageOptions));
        updatePost();
    }

    // delete text color from local storage
    function deleteImageOptions() {
        localStorage.removeItem("imageOptions");
        updatePost();
    }

    // delete text color from local storage
    function deleteTextColors() {
        localStorage.removeItem("colors");
        updatePost();
    }

    // delete font from local storage
    function deleteFonts() {
        localStorage.removeItem("fonts");
        updatePost();
    }

    return (
        <main class="flex flex-col gap-5 items-center max-h-screen h-screen p-4 min-sm:w-full">
            <div class="navbar bg-base-300 rounded-box">
                <div class="flex-1 flex flex-row gap-2 items-center">
                    <a onclick={() => setToggleMenu(!toggleMenu())} class="btn btn-ghost text-xl">Deltos Publisher</a>
                </div>
                <div class="flex gap-3">
                    <a onclick={() => navigate("/input/"+postType()+"/load")} class="btn btn-ghost">Edit content</a>
                    <div class="dropdown dropdown-end">
                        <div tabindex="0" role="button" class="btn btn-error">
                            <div class="indicator">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960"
                                     width="24px">
                                    <path
                                        d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
                                </svg>
                            </div>
                            Download
                        </div>
                        <div
                            tabindex="0"
                            class="card card-compact dropdown-content bg-base-200 z-[1] mt-5 w-52 shadow">
                            <div class="card-body">
                                <span class="text-lg font-bold">Export Image</span>
                                <span class="text-info">1080x1080</span>
                                <div class="card-actions">
                                    <button class="btn btn-primary btn-block" onClick={handleDownload}>Download</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-row max-md:flex-col gap-2 w-full">
                <Show when={toggleMenu()}>
                    <div class="flex flex-col bg-base-200 grow-0 w-fit basis-md p-4 gap-3 rounded-box overflow-auto">
                        <div class="collapse collapse-plus bg-base-300">
                            <input type="radio" name="my-accordion-3"/>
                            <div class="collapse-title text-xl font-medium">Colors</div>
                            <div class="collapse-content">
                                <div class="flex flex-col gap-2">
                                    <label class="input bg-transparent w-full h-12">
                                        <span class="label min-w-[35%] h-full">Title</span>
                                        <input onchange={(e) => {
                                            render.textColor.title = e.target.value || "#009fe3";
                                            updatePost();
                                        }} type="text" placeholder={render.textColor.title}/>
                                    </label>
                                    <label class="input bg-transparent w-full h-12">
                                        <span class="label min-w-[35%] h-full">Subtitle</span>
                                        <input onchange={(e) => {
                                            render.textColor.subtitle = e.target.value || "#cd0070";
                                            updatePost();
                                        }} type="text" placeholder={render.textColor.subtitle}/>
                                    </label>
                                    <label class="input bg-transparent w-full h-12">
                                        <span class="label min-w-[35%] h-full">Content</span>
                                        <input onchange={(e) => {
                                            render.textColor.content = e.target.value || "#003399";
                                            updatePost();
                                        }} type="text" placeholder={render.textColor.content}/>
                                    </label>
                                    <label class="input bg-transparent w-full h-12">
                                        <span class="label min-w-[35%] h-full">Background</span>
                                        <input onchange={
                                            (e) => {
                                                render.backgroundColor = e.target.value || "#fff";
                                                updatePost();
                                            }
                                        } type="text" placeholder={render.backgroundColor || "Transparent"}/>
                                    </label>

                                    <button class="btn btn-success" onclick={updateTextColors}>Save as default</button>
                                    <button class="btn btn-error" onclick={deleteTextColors}>Delete default</button>
                                </div>
                            </div>
                        </div>
                        <div class="collapse collapse-plus bg-base-300">
                            <input type="radio" name="my-accordion-3"/>
                            <div class="collapse-title text-xl font-medium">Fonts</div>
                            <div class="collapse-content flex flex-col gap-2">
                                <label class="input bg-transparent w-full h-12">
                                    <span class="label min-w-[35%] h-full">Title</span>
                                    <input onchange={(e) => {
                                        render.fontFamily.title = e.target.value || "Franklin Gothic Heavy";
                                        updatePost();
                                    }} type="text" placeholder={render.fontFamily.title}/>
                                </label>
                                <label class="input bg-transparent w-full h-12">
                                    <span class="label min-w-[35%] h-full">Subtitle</span>
                                    <input onchange={(e) => {
                                        render.fontFamily.subtitle = e.target.value || "Franklin Gothic Heavy";
                                        updatePost();
                                    }} type="text" placeholder={render.fontFamily.subtitle}/>
                                </label>
                                <label class="input bg-transparent w-full h-12">
                                    <span class="label min-w-[35%] h-full">Content</span>
                                    <input onchange={(e) => {
                                        render.fontFamily.content = e.target.value || "Franklin Gothic Medium";
                                        updatePost();
                                    }} type="text" placeholder={render.fontFamily.content}/>
                                </label>

                                <button class="btn btn-success" onclick={updateFonts}>Save as default</button>
                                <button class="btn btn-error" onclick={deleteFonts}>Delete default</button>
                            </div>
                        </div>
                        <div class="collapse collapse-plus bg-base-300">
                            <input type="radio" name="my-accordion-3"/>
                            <div class="collapse-title text-xl font-medium">Image</div>
                            <div class="collapse-content flex flex-col gap-2 overflow-auto">
                                <p>
                                    Horizontal position
                                </p>
                                <div class="flex flex-row gap-2 items-center">
                                    <h2 class="border border-neutral w-14 text-center p-2 py-1 rounded-md">{imageOptionState().x}</h2>
                                    <input type="range" min="-10" max="90" value={imageOptionState().x} class="range" onchange={
                                        (e) => {
                                            render.imageOptions.x = parseInt(e.target.value) || 0;
                                            updatePost();
                                        }
                                    }/>
                                </div>
                                <p>
                                    Vertical position
                                </p>
                                <div class="flex flex-row gap-2 items-center">
                                    <h2 class="border border-neutral w-14 text-center p-2 py-1 rounded-md">{imageOptionState().y}</h2>
                                    <input type="range" min="-10" max="90" value={imageOptionState().y} class="range" onchange={
                                        (e) => {
                                            render.imageOptions.y = parseInt(e.target.value) || 0;
                                            updatePost();
                                        }
                                    }/>
                                </div>
                                <p>Rotation</p>
                                <div class="flex flex-row gap-2 items-center">
                                    <h2 class="border border-neutral w-14 text-center p-2 py-1 rounded-md">{imageOptionState().rotation}</h2>
                                    <input type="range" min="-45" max="45" value={imageOptionState().rotation} class="range" onchange={
                                        (e) => {
                                            render.imageOptions.rotation = parseInt(e.target.value) || 0;
                                            updatePost();
                                        }
                                    }/>
                                </div>
                                <p>Size</p>
                                <div class="flex flex-row gap-2 items-center">
                                    <h2 class="border border-neutral w-14 text-center p-2 py-1 rounded-md">{imageOptionState().size}</h2>
                                    <input type="range" min="100" max="700" value={imageOptionState().size} class="range" onchange={
                                        (e) => {
                                            render.imageOptions.size = parseInt(e.target.value) || 450;
                                            updatePost();
                                        }
                                    }/>
                                </div>
                                <p>Corner Radius</p>
                                <div class="flex flex-row gap-2 items-center">
                                    <h2 class="border border-neutral w-14 text-center p-2 py-1 rounded-md">{imageOptionState().radius}</h2>
                                    <input type="range" min="0" max="100" value={imageOptionState().radius} class="range" onchange={
                                        (e) => {
                                            render.imageOptions.radius = parseInt(e.target.value) || 0;
                                            updatePost();
                                        }
                                    }/>
                                </div>
                                <button class="btn btn-success" onclick={updateImageOptions}>Save as default</button>
                                <button class="btn btn-error" onclick={deleteImageOptions}>Delete default</button>
                            </div>
                        </div>
                        <div class="collapse collapse-plus  bg-base-300">
                            <input type="radio" name="my-accordion-3"/>
                            <div class="collapse-title text-xl font-medium">Logo</div>
                            <div class="collapse-content  overflow-auto ">
                                <div class="flex flex-col gap-2">
                                    {logoDataURL() ?
                                        <p class="img-preview-wrapper w-full border border-neutral rounded-2xl flex justify-center items-center">
                                            {
                                                <img src={logoDataURL() != undefined ? logoDataURL() as string : ""}
                                                     class="rounded-2xl p-2" alt="preview"/>
                                            }
                                        </p> : null}
                                    <label class="input bg-transparent h-12 w-full mb-2">
                                        <span class="label min-w-[25%]">Logo</span>
                                        <input accept="image/*" oninput={
                                            (e) => {
                                                // @ts-ignore
                                                const file = e.target.files[0];
                                                const reader = new FileReader();
                                                reader.onload = (e) => {
                                                    setLogoDataURL(e.target?.result as string);
                                                    updatePost();
                                                }
                                                reader.readAsDataURL(file);
                                            }
                                        } type="file" class="file-input file-input-ghost w-full max-w-xs"
                                               placeholder="Image"/>
                                    </label>

                                    <p>Size</p>
                                    <input type="range" min="1" max="50" value={JSON.parse(localStorage.getItem("logo") || '{"logoMultipler": "10"}').logoMultipler} class="range" onchange={
                                        (e) => {
                                            console.log(e.target.value);
                                            logoMultipler = parseInt(e.target.value);
                                            updatePost();
                                        }
                                    }/>

                                    <button class="btn btn-success mt-4" onclick={
                                        () => {
                                            // save the logo as default
                                            let logo_data = {
                                                logoDataURL: logoDataURL(),
                                                logoMultipler: logoMultipler
                                            };
                                            localStorage.setItem("logo", JSON.stringify(logo_data));
                                        }
                                    }>Save as default
                                    </button>
                                    <button class="btn btn-error" onclick={
                                        () => localStorage.removeItem("logo")
                                    }>Delete default
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>
                <div class="w-full flex justify-center items-center grow">
                    <div class="flex flex-row bg-base-200 p-5 rounded-box w-fit">
                        <canvas
                            ref={canvasRef}
                            id="canvas"
                            class="border-neutral border aspect-square max-h-[80vh] rounded-md"
                            width="1080"
                            height="1080"
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}

export default RenderSite;