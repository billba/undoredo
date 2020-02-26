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

interface IncAAction {
  type: 'incA';
}

interface AddToAAction {
  type: 'addToA',
  whatToAdd: number,
}

interface SetAAction {
  type: 'setA',
  a: number,
}

type ThingAction =
| IncAAction
| AddToAAction
| SetAAction
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
  type: 'LoadStuff',
}
| {
  type: 'SetStuff',
  stuff: string,
}
| {
  type: 'ResetStuff',
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

      case 'appendToB':
        return {
          ... state,
          b: state.b + action.whatToAppend
        }

      case 'addToA': 
        return {
          ... state,
          a: state.a + action.whatToAdd
        }
      
      case 'LoadStuff':
        return {
          ... state,
          stuff: null,
        }

      case 'SetStuff':
        return {
          ... state,
          stuff: action.stuff,
        }
  
      case 'ResetStuff':
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

type UndoableAction = 
| IncAAction
| AddToAAction;

type RedoableAction = UndoableAction | SetAAction;

interface UndoRedo {
  undoAction: RedoableAction,
  redoAction: RedoableAction,
  text: string,
}

interface PushUndoAction {
  type: 'PushUndo',
  undoredo: UndoRedo, 
}

interface UndoState {
  undo: Array<UndoRedo>;
  redo: Array<UndoRedo>;
}

type UndoAction = 
| PushUndoAction
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

// interface CountState {
// }

// type CountAction = {
//   type: 'inc_count'
// } | {

// }

function getPushUndoAction(
  state: AppState,
  action: AppAction
): PushUndoAction | null {
  let undoAction: RedoableAction;
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

const middle: Middleware<{}, AppState, Dispatch<AppAction>> = storeMW => next => (action: AppAction & UndoFlag) => {
  const { dispatch, getState } = storeMW;
  const state = getState();

  switch (action.type) {
    case 'LoadStuff': {
      const result = next(action);
      setTimeout(() => dispatch({ type: 'SetStuff', stuff: `Stuff`}), 1000);
      return result;
    }

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
    applyMiddleware(middle)
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
  const loadStuff = useCallback(() => dispatch({ type: 'LoadStuff' }), []);
  const resetStuff = useCallback(() => dispatch({ type: 'ResetStuff' }), []);

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
  const { isUndo, isRedo } = useSelector((state: AppState) => ({
    isUndo: state.undoredo.undo.length > 0,
    isRedo: state.undoredo.redo.length > 0,
  }), shallowEqual);
  console.log("undoredo", undoredo);
  const dispatch = useDispatch<Dispatch<AppAction>>();

  const undo = useCallback(() => dispatch({ type: 'Undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'Redo' }), []);

  return <div>
    { isUndo
      ? <button onClick={ undo }>Undo</button>
      : <button disabled>Undo</button>
    }
    { isRedo
      ? <button onClick={ redo }>Redo</button>
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
