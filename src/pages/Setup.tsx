import { createSignal } from "solid-js";
import { PostTypes } from "../types/Stages";
import SelectionCard from "../components/cards/SelectionCard";
import {useNavigate} from "@solidjs/router";

function Setup() {
    const [postType, setPostType] = createSignal(PostTypes.UNSET);
    const navigate = useNavigate();

    return (
        <div class="min-h-screen flex flex-col bg-base-200">
            {/* Navbar */}
            <nav class="navbar bg-base-100 shadow-lg">
                <div class="flex-1">
                    <a class="normal-case text-xl" href="/">
                        Deltos Publisher
                    </a>
                </div>
            </nav>

            {/* Main Content */}
            <main class="container mx-auto px-4 py-8 flex-grow bg-base-100">
                {/* Hero Section */}
                <section class="hero mb-8">
                    <div class="hero-content flex-col lg:flex-row">
                        <div class="text-center lg:text-left">
                            <h1 class="text-5xl font-bold">Welcome!</h1>
                            <p class="py-6 text-lg">
                                Create a new social media post by selecting a type below, or continue your last session.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Selection Cards */}
                <section class="flex flex-col md:flex-row justify-center  items-center gap-4 mb-8">
                    <SelectionCard
                        onClickHandle={() => setPostType(PostTypes.QUOTE)}
                        displayName="Zitat"
                        description="Erstellung eines Zitatposts"
                        tags={["Zitat", "Variationen"]}
                        img="https://kilikoi.de/wp-content/uploads/2020/03/quote.png"
                        handleValueChange={postType() === PostTypes.QUOTE}
                    />
                    <SelectionCard
                        onClickHandle={() => setPostType(PostTypes.TOPIC)}
                        displayName="Thema"
                        description="Erstellung eines Posts zu einem Thema"
                        tags={["Themen", "Variationen"]}
                        img="https://t3.ftcdn.net/jpg/04/17/61/90/360_F_417619090_iVZEF560PanNYbGrgzcb0P9gYhyXFX2o.jpg"
                        handleValueChange={postType() === PostTypes.TOPIC}
                    />
                    <SelectionCard
                        onClickHandle={() => setPostType(PostTypes.REMEMBER)}
                        displayName="Gedenken"
                        description="Erstellung eines Gedenkposts"
                        tags={["Gedenken", "Erinnerung"]}
                        img="https://img.freepik.com/fotos-premium/konzept-der-trauer-kerze-dunkel-auf-schwarzem-hintergrundrip_431724-10319.jpg?w=360"
                        handleValueChange={postType() === PostTypes.REMEMBER}
                    />
                </section>

                {/* Action Buttons */}
                <section class="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button
                        class={postType() !== PostTypes.UNSET ? "btn btn-primary" : "btn btn-disabled"}
                        onClick={() => {
                            if (postType() !== PostTypes.UNSET) {
                                navigate(`/input/${postType().toLowerCase()}`);
                            }
                        }}
                    >
                        Create Post
                    </button>
                    <button
                        class="btn btn-success"
                        onClick={() => navigate("/creator/topic")}
                    >
                        Continue last session
                    </button>
                </section>
            </main>

            {/* Footer */}
            <footer class="footer p-4 bg-base-100 text-base-content">
                <div class="flex justify-center items-center w-full">
                    <p>© 2025 Deltos Publisher by <a class="underline" href="https://github.com/agentquackyt">AgentQuack</a>. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default Setup;
