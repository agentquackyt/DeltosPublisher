function Sidebar() {
    return (
        <div class="p-4">
            <ul class="menu bg-base-200 rounded-box w-56">
                <li><a>Item 1</a></li>
                <li>
                    <a>Parent</a>
                    <ul>
                        <li><a>Submenu 1</a></li>
                        <li><a>Submenu 2</a></li>
                    </ul>
                </li>
                <li><a>Item 3</a></li>
            </ul>
        </div>
    );
}

export default Sidebar;