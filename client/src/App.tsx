import React, { useCallback, useMemo } from 'react';
import ApolloClient, {  } from 'apollo-boost';
import { gql } from "apollo-boost";
import { ApolloProvider, useQuery, useMutation } from '@apollo/react-hooks';

import { createStore, Reducer, Dispatch, applyMiddleware, Middleware, combineReducers } from 'redux';
import { useSelector, useDispatch, shallowEqual, Provider } from 'react-redux';

interface ThingStateAction {
  a: number,
  b: string,
  stuff?: string | null,
}

type ThingAction =
| {
  type: 'incA';
}
| {
  type: 'addToA',
  whatToAdd: number,
}
| {
  type: 'setA',
  a: number,
}
| {
  type: 'init',
}
| {
  type: 'appendToB',
  whatToAppend: string,
}
| {
  type: 'setB',
  b: string,
}
| {
  type: 'loadStuff',
}
| {
  type: 'setStuff',
  stuff: string,
}
| {
  type: 'resetStuff',
}

const thing: Reducer<ThingStateAction, ThingAction> = (
  state = { a: 13, b: "hello" },
  action,
) => {
    switch (action.type) {
      case 'setA':
        return {
          ... state,
          a: action.a,
      }

      case 'incA':
        return {
          ... state,
          a: state.a + 1,
        }

      case 'addToA': 
        return {
          ... state,
          a: state.a + action.whatToAdd
        }

      case 'setB':
        return {
          ... state,
          b: action.b,
        }

      case 'appendToB':
        return {
          ... state,
          b: state.b + action.whatToAppend
        }

      case 'loadStuff':
        return {
          ... state,
          stuff: null,
        }

      case 'setStuff':
        return {
          ... state,
          stuff: action.stuff,
        }
  
      case 'resetStuff':
        return {
          ... state,
          stuff: undefined,
        }

      default:
        return state;
      }
}

interface CountState {
}

type CountAction =
| {
  type: 'incCount',
}
| {
  type: 'incCount_complete',
}
| {
  type: 'incCount_fail',
}
| {
  type: 'decCount',
}
| {
  type: 'decCount_complete',
}
| {
  type: 'decCount_fail',
}


const count: Reducer<CountState, CountAction> = (
  state = {},
  action,
) => {
  return state;
}

interface UndoFlag {
  undo?: boolean;
}

interface UndoRedo {
  undoAction: AppAction,
  redoAction: AppAction,
  text: string,
}

interface UndoState {
  undo: Array<UndoRedo>;
  redo: Array<UndoRedo>;
}

type UndoAction = 
| {
  type: 'PushUndo',
  undoredo: UndoRedo, 
}
| {
  type: 'Undo',
} 
| {
  type: 'Redo',
}
| {
  type: 'ClearUndo',
}

const undoredo: Reducer<UndoState, UndoAction> = (
  state = { undo: [],  redo: [] },
  action,
) => {
  switch (action.type) {
    case 'PushUndo':
      return {
        ... state,
        undo: [action.undoredo, ... state.undo],
        redo: [],
      }

    case 'Undo': {
      const [undoredo, ... undo] = state.undo;

      return {
        ... state,
        undo,
        redo: [undoredo, ... state.redo],
      }
    }

    case 'Redo': {
      const [undoredo, ... redo] = state.redo;

      return {
        ... state,
        redo,
        undo: [undoredo, ... state.undo],
      }
    }

    case 'ClearUndo':
      return {
        undo: [],
        redo: [],
      }

    default:
      return state;
  }
}

type AppAction = 
| ThingAction
| CountAction
| UndoAction
;

type AppState = {
  thing: ThingStateAction,
  undoredo: UndoState,
}

const client = new ApolloClient({
  // cache: new InMemoryCache(),
  uri: 'http://localhost:4000',
});

const asyncMiddleware: Middleware<{}, AppState, Dispatch<AppAction>> = storeMW => next => (action: AppAction & UndoFlag) => {
  const { dispatch, getState } = storeMW;
  const state = getState();
  const undo = action.undo;

  switch (action.type) {
    case 'loadStuff': {
      const result = next(action);
      setTimeout(() => dispatch({ type: 'setStuff', stuff: `Stuff`, undo}), 1000);
      return result;
    }

    case 'incCount': {
      const result = next(action);
      client
        .mutate({ mutation: INC_COUNT })
        .then(result => dispatch({ type: 'incCount_complete', undo}))
        .catch(error => dispatch({ type: 'incCount_fail', undo}));
      return result;
    }

    case 'decCount': {
      const result = next(action);
      client
        .mutate({ mutation: DEC_COUNT })
        .then(result => dispatch({ type: 'decCount_complete', undo}))
        .catch(error => dispatch({ type: 'decCount_fail', undo}));
      return result;
    }

    default:
      return next(action);
  }
}

function getPushUndoAction(
  state: AppState,
  action: AppAction
): AppAction | null {
  let undoAction: AppAction;
  let redoAction = action;
  let text: string;

  switch (action.type) {
    case 'incA':
      undoAction = {
        type: 'setA',
        a: state.thing.a,
      }
      text = 'inc A';
      break;

    case 'addToA':
      undoAction = {
        type: 'setA',
        a: state.thing.a,
      }
      text = 'add to A';
      break;
    
    case 'appendToB':
      undoAction = {
        type: 'setB',
        b: state.thing.b,
      }
      text = 'append to B';
      break;
    
    case 'setStuff':
      undoAction = {
        type: 'resetStuff',
      }
      text = 'load Stuff';
      break;

    case 'resetStuff':
      undoAction = {
        type: 'setStuff',
        stuff: state.thing.stuff!,
      }
      text = 'reset Stuff';
      break;

    case 'incCount_complete':
      undoAction = {
        type: 'decCount',
      }
      redoAction = {
        type: 'incCount',
      }
      text = 'inc Count';
      break;

    case 'decCount_complete':
      undoAction = {
        type: 'incCount',
      }
      redoAction = {
        type: 'decCount',
      }
      text = 'dec Count';
      break;
  
    default:
      return null;
  }

  return {
    type: 'PushUndo',
    undoredo: {
      undoAction,
      redoAction,
      text,
    }
  }  
}

const undoredoMiddleware: Middleware<{}, AppState, Dispatch<AppAction>> = storeMW => next => (action: AppAction & UndoFlag) => {
  const { dispatch, getState } = storeMW;
  const state = getState();

  console.log("undoredo", action);

  switch (action.type) {
    case 'Undo': {
      const _action = {
        ... state.undoredo.undo[0].undoAction,
        undo: true,
      }
      next(action);
      return dispatch(_action);
    }

    case 'Redo': {
      const _action = {
        ... state.undoredo.redo[0].redoAction,
        undo: true,
      }
      next(action);
      return dispatch(_action);
    }

    default:
      if (!action.undo) {
        const pushUndoAction = getPushUndoAction(state, action);

        if (pushUndoAction) {
          const result = next(action);
          dispatch(pushUndoAction);
          return result;
        }
      }

      return next(action);
    }
}

import { composeWithDevTools } from 'redux-devtools-extension';

const store = createStore(
  combineReducers({
    thing,
    undoredo,
    count,
  }),
  composeWithDevTools(
    applyMiddleware(
      asyncMiddleware,
      undoredoMiddleware,
    )
  ),
);

store.dispatch({ type: 'init' });

const COUNT = gql`
  query GetCount {
    getCount {
      id
      count
    }
  }
`;

const OTHER_COUNT = gql`
  query OtherCount {
    getCount { id count }
  }
`;

const INC_COUNT = gql`
  mutation IncCount {
    incCount {
      id
      count
    }
  }
`;

const DEC_COUNT = gql`
  mutation DecCount {
    decCount {
      id
      count
    }
  }
`;

// function useForceUpdate() {
//   return useReducer(s => s + 1, 0)[1];
// }

function Count(this: any) {
  // const [_incCount] = useMutation(INC_COUNT);
  // const [_decCount] = useMutation(DEC_COUNT);
  // const incCount = useCallback(() => _incCount(), []);
  // const decCount = useCallback(() => _decCount(), []);

  const { loading, error, data } = useQuery(COUNT);

  const dispatch = useDispatch<Dispatch<AppAction>>();
  const incCount = useCallback(() => dispatch({ type: 'incCount' }), []);
  const decCount = useCallback(() => dispatch({ type: 'decCount' }), []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return <>
    <button onClick={ incCount }>inc</button>
    <button onClick={ decCount }>dec</button>
    <div>count: { data.getCount.count } </div>
    <div>time: { Date.now() }</div>
  </>;
}

function OtherCount() {
  const { loading, error, data } = useQuery(OTHER_COUNT);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return <>
    <div>same count: { data.getCount.count } </div>
  </>;
}

function ShowChangeThing({ incA, add5ToA, appendToB}: {
  incA: () => void,
  add5ToA: () => void,
  appendToB: () => void,
}) {
  return (
    <div>
      <button onClick={ incA }>Inc</button>
      <button onClick={ add5ToA }>Add 5</button>
      <button onClick={ appendToB }>Add "+"</button>
    </div>
  );
}

function ChangeThing() {
  const dispatch = useDispatch<Dispatch<AppAction>>();

  const callbacks = useMemo(() => ({
    incA: () => dispatch({ type: 'incA' }),
    appendToB: () => dispatch({ type: 'appendToB', whatToAppend: '+' }),
    add5ToA: () => dispatch({ type: 'addToA', whatToAdd: 5 }),
  }), []);

  return <ShowChangeThing { ... callbacks }/>;
}

function ShowThingA() {
  console.log("A");
  const { a } = useSelector((state: AppState) => ({ a: state.thing.a }), shallowEqual);

  return <div>
    Thing.a is { a }
  </div>
}

function ShowThingB() {
  console.log("B");
  const { b } = useSelector((state: AppState) => ({ b: state.thing.b }), shallowEqual);

  return <div>
    Thing.b is { b }
  </div>
}

function ShowThing() {
  return <>
    <ShowThingA/>
    <ShowThingB/>
  </>;
}

function AllThing() {
  return <>
    <ChangeThing/>
    <ShowThing/>
  </>;
}

function Async() {
  const { stuff } = useSelector((state: AppState) => ({ stuff: state.thing.stuff }), shallowEqual);
  const dispatch = useDispatch<Dispatch<AppAction>>();
  const loadStuff = useCallback(() => dispatch({ type: 'loadStuff' }), []);
  const resetStuff = useCallback(() => dispatch({ type: 'resetStuff' }), []);

  return <div>
    { stuff === undefined ? <button onClick={ loadStuff }>Load Stuff</button> :
      stuff === null ? "Loading..." : 
      <>
        stuff
        <button onClick={ resetStuff }>Reset</button>
      </>
    }
  </div>
}

function Undo() {
  const { undoText, redoText } = useSelector((state: AppState) => ({
    undoText: state.undoredo.undo.length > 0 ? state.undoredo.undo[0].text : undefined,
    redoText: state.undoredo.redo.length > 0 ? state.undoredo.redo[0].text : undefined,
  }), shallowEqual);
  const dispatch = useDispatch<Dispatch<AppAction>>();

  const undo = useCallback(() => dispatch({ type: 'Undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'Redo' }), []);

  return <div>
    { undoText
      ? <button onClick={ undo }>Undo { undoText }</button>
      : <button disabled>Undo</button>
    }
    { redoText
      ? <button onClick={ redo }>Redo { redoText }</button>
      : <button disabled>Redo</button>
    }
  </div>;
}

export const App = () => (
  <Provider store={ store}>
    <ApolloProvider client={client}>
        <Undo />
        <h2>GQL</h2>
        <Count />
        <OtherCount />
        <h2>Redux</h2>
        <AllThing />
        <Async />
    </ApolloProvider>
  </Provider>
);
