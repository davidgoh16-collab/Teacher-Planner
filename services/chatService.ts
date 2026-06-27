import { getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { AIConversation } from '../types';
import { userCol, userDocRef } from './userScope';

const CONVERSATIONS_COLLECTION = 'teacher_planner_ai_conversations';

export const fetchAIConversations = async (): Promise<AIConversation[]> => {
    try {
        const querySnapshot = await getDocs(userCol(CONVERSATIONS_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as AIConversation).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
        console.error("Error fetching AI conversations", e);
        return [];
    }
};

export const saveAIConversation = async (conversation: AIConversation): Promise<void> => {
    try {
        await setDoc(userDocRef(CONVERSATIONS_COLLECTION, conversation.id), conversation);
    } catch (e) {
        console.error("Error saving AI conversation", e);
        throw e;
    }
};

export const deleteAIConversation = async (id: string): Promise<void> => {
    try {
        await deleteDoc(userDocRef(CONVERSATIONS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting AI conversation", e);
        throw e;
    }
};
