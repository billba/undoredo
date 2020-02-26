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

type AppAction = ThingAction | UndoAction;

type AppState = {
  thing: ThingStateAction,
  undoredo: UndoState,
}

function getPushUndoAction(
  state: AppState,
  action: AppAction
): AppAction | null {
  let undoAction: AppAction;
  let text: string;

  switch (action.type) {
    case 'incA':
      undoAction = {
        type: 'setA',
        a: state.thing.a,
      };
      text = 'inc A';
      break;

    case 'addToA':
      undoAction = {
        type: 'setA',
        a: state.thing.a,
      };
      text = 'add to A';
      break;
    
    case 'appendToB':
      undoAction = {
        type: 'setB',
        b: state.thing.b,
      };
      text = 'append to B';
      break;
    
    case 'setStuff':
      undoAction = {
        type: 'resetStuff',
      };
      text = 'load Stuff';
      break;

    case 'resetStuff':
      undoAction = {
        type: 'setStuff',
        stuff: state.thing.stuff!,
      };
      text = 'reset Stuff';
      break;

    default:
      return null;
  }

  return {
    type: 'PushUndo',
    undoredo: {
      undoAction,
      redoAction: action,
      text,
    }
  }  
}

const asyncMiddleware: Middleware<{}, AppState, Dispatch<AppAction>> = storeMW => next => (action: AppAction & UndoFlag) => {
  const { dispatch, getState } = storeMW;
  const state = getState();

  switch (action.type) {
    case 'loadStuff': {
      const result = next(action);
      setTimeout(() => dispatch({ type: 'setStuff', stuff: `Stuff`}), 1000);
      return result;
    }

    default:
      return next(action);
  }
}


const undoredoMiddleware: Middleware<{}, AppState, Dispatch<AppAction>> = storeMW => next => (action: AppAction & UndoFlag) => {
  const { dispatch, getState } = storeMW;
  const state = getState();

  switch (action.type) {
    case 'Undo': {
      dispatch({
        ... state.undoredo.undo[0].undoAction,
        undo: true,
      });
      return next(action);
    }

    case 'Redo': {
      dispatch({
        ... state.undoredo.redo[0].redoAction,
        undo: true,
      });
      return next(action);
    }

    default:
      if (!action.undo) {
        const pushUndoAction = getPushUndoAction(state, action);

        if (pushUndoAction) {
          next(action);
          return dispatch(pushUndoAction);
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
  }),
  composeWithDevTools(
    applyMiddleware(
      asyncMiddleware,
      undoredoMiddleware,
    )
  ),
);

store.dispatch({ type: 'init' });

const client = new ApolloClient({
  // cache: new InMemoryCache(),
  uri: 'http://localhost:4000',
});

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

// function useForceUpdate() {
//   return useReducer(s => s + 1, 0)[1];
// }

function Count() {
    const [incCount] = useMutation(INC_COUNT
    //   , {
    //   update(cache, data) {
    //     console.log("data was", data);
    //     const { count } = cache.readQuery({ query: COUNT }) as any;
    //     cache.writeQuery({
    //       query: COUNT,
    //       data: { count },
    //     });
    //   }
    // }
    );

    const { loading, error, data } = useQuery(COUNT);
    const cb = useCallback(() => {
      incCount();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error :(</p>;
  
    return <>
      <button onClick={ cb }>inc</button>
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
  console.log("undoredo", undoredo);
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
