function SelectionCard(props: { displayName: string, description: string, tags: string[], onClickHandle?: Function, img?: string, handleValueChange: boolean }) {
    return (
        <div
            class={`card ${
                props.handleValueChange ? "-translate-y-2 bg-base-300" : "bg-base-200"
            } duration-700 hover:bg-base-300 w-full hover:shadow-xl hover:-translate-y-2 transition ease-snappy`}
            onClick={() => props.onClickHandle?.()}
        >
            <figure class="object-cover">
                <img
                    src={props.img != undefined ? props.img : "https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"}
                    alt={props.displayName}
                    draggable={false}
                    class="object-cover w-full h-full aspect-video"
                />
            </figure>
            <div class="card-body">
                <h2 class="card-title">
                    {props.displayName}
                    {/*<div class="badge badge-secondary">NEW</div>*/}
                </h2>
                <p>{props.description}</p>
                <div class="card-actions justify-end">
                    {
                        props.tags.map(tag => <div class="badge badge-outline">{tag}</div>)
                    }
                </div>
            </div>
        </div>
    );
}

export default SelectionCard;