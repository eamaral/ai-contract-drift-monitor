/**
 * GraphQL Introspection Helper
 * 
 * This module handles GraphQL schema introspection to detect
 * API changes at the schema level, not just query response level.
 */

export const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  }
`;

export interface GraphQLIntrospectionResult {
  __schema: {
    queryType: { name: string } | null;
    mutationType: { name: string } | null;
    subscriptionType: { name: string } | null;
    types: Array<{
      kind: string;
      name: string;
      description?: string;
      fields?: Array<{
        name: string;
        description?: string;
        isDeprecated: boolean;
        deprecationReason?: string;
        type: {
          name?: string;
          kind: string;
          ofType?: {
            name?: string;
            kind: string;
          };
        };
      }>;
    }>;
  };
}

/**
 * Extract simplified schema from introspection result
 * Focuses on user-defined types (excludes built-in GraphQL types)
 */
export function extractGraphQLSchema(introspection: GraphQLIntrospectionResult): Record<string, any> {
  const schema: Record<string, any> = {};
  
  const userTypes = introspection.__schema.types.filter(type => 
    !type.name.startsWith('__') && // Exclude introspection types
    type.kind === 'OBJECT' &&      // Only objects
    type.fields &&                  // Has fields
    type.fields.length > 0 &&
    // Focus on main business types (customize as needed)
    !['Query', 'Mutation', 'Subscription'].includes(type.name)
  );
  
  for (const type of userTypes) {
    if (!type.fields) continue;
    
    const fieldsList: string[] = [];
    
    for (const field of type.fields) {
      const fieldType = field.type.ofType?.name || field.type.name || field.type.kind;
      const deprecated = field.isDeprecated ? '[DEPRECATED]' : '';
      const fieldInfo = deprecated ? `${field.name}:${fieldType}${deprecated}` : `${field.name}:${fieldType}`;
      fieldsList.push(fieldInfo);
    }
    
    // Store as array of field signatures
    schema[type.name] = fieldsList.sort(); // Sort for consistent comparison
  }
  
  return schema;
}

/**
 * Check if a target is GraphQL based on URL or body
 */
export function isGraphQLTarget(url: string, body?: unknown): boolean {
  // Check if URL contains 'graphql'
  if (url.toLowerCase().includes('graphql')) {
    return true;
  }
  
  // Check if body has a 'query' field (GraphQL convention)
  if (body && typeof body === 'object' && 'query' in body) {
    return true;
  }
  
  return false;
}
