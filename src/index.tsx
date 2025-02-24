/* @refresh reload */
import {render} from 'solid-js/web';
import {Route, HashRouter} from "@solidjs/router";

import './index.css';
import Setup from "./pages/Setup";
import InputForm from "./pages/InputForm";
import RenderSite from "./pages/RenderSite";

const root = document.getElementById('root');

const App = (props: any) => (
    <div class="flex flex-row bg-base-100 h-screen justify-center items-center">
        {props.children}
    </div>
);

render(() => (
    <HashRouter root={App}>
        <Route path="/" component={Setup}/>
        <Route path="/input/:type/:load?" component={InputForm}/>
        <Route path="/creator/:type" component={RenderSite}/>

        <Route path="*paramName" component={Setup}/>
    </HashRouter>
), root!);
