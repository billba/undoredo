// import express from 'express';
// import bodyParser from 'body-parser';
// import cors from 'cors';

import { ApolloServer, gql } from 'apollo-server';

const typeDefs = gql`
    type Count {
        count: Int
        id: String
    }

    type Query {
        getCount: Count
    }

    type Mutation {
        incCount: Count
    }
`

let count = 0;
let id = 'YOUR_ID_HERE';

const resolvers = {
    Query: {
        getCount: () => {
            console.log("getCount");
            return {
                id,
                count
            }
        },
    },
    Mutation: {
        incCount: () => {
            console.log("incCount");
            return {
                id,
                count: ++count
            }
        }
    },
}

const server = new ApolloServer({ typeDefs, resolvers });

server
    .listen()
    .then(url => console.log(`🚀  Server ready at ${url}`));

// express()
//     .use(cors())
//     .use(bodyParser.json())
//     .post('/graphql', (req, res) => {
//         console.log(`received`, req.body);
//         graphql(schema, req.body.query)
//             .then(result => res.send(JSON.stringify(result, null, 2)));
//     })
//     .listen(3000);