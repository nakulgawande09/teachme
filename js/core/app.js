import { createStore } from './store.js';
import { reducer } from './reducer.js';
import { INITIAL } from './state.js';
import { act } from './actions.js';

/**
 * The store singleton. Kept in its own module so router, engines and render
 * can all reach it without importing each other — the shortest way to avoid
 * a circular dependency graph in native ES modules.
 */
export const store = createStore(reducer, INITIAL);

export const dispatch = (type, payload) => store.dispatch(act(type, payload));
export const getState = () => store.getState();
